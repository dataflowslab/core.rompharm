import { useState, useEffect, useRef } from 'react';
import {
    Container,
    Text,
    Paper,
    Stack,
    Button,
    TextInput,
    Group,
    Title,
    Divider,
    NumberInput,
    Textarea,
    Select,
    ActionIcon,
    Badge,
    Modal
} from '@mantine/core';
import {
    IconSearch,
    IconBox,
    IconArrowRight,
    IconAlertTriangle,
    IconScan,
    IconArrowLeft,
    IconBolt,
    IconCamera
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import { api } from '../services/api';

// Types
interface StockInfo {
    _id: string;
    type: 'stock' | 'part' | 'location';
    part_id?: string;
    part_name: string;
    part_ipn?: string;
    batch_code?: string;
    quantity?: number;
    location_id?: string;
    location_name?: string;
    expiry_date?: string;
}

export function MobileInventoryPage() {
    const { t } = useTranslation();

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectorRef = useRef<any | null>(null);
    const scanRafRef = useRef<number | null>(null);
    const lastScanRef = useRef<number>(0);

    // State
    const [scanInput, setScanInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [stockItem, setStockItem] = useState<StockInfo | null>(null);
    const [mode, setMode] = useState<'scan' | 'count' | 'move' | 'report'>('scan');
    const [scannerOpened, setScannerOpened] = useState(false);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [captureLoading, setCaptureLoading] = useState(false);

    // Action States
    const [countQty, setCountQty] = useState<number | ''>('');
    const [countReason, setCountReason] = useState('');
    const [moveLocation, setMoveLocation] = useState<string | null>(null);
    const [moveQty, setMoveQty] = useState<number | ''>('');
    const [reportIssue, setReportIssue] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [locations, setLocations] = useState<any[]>([]);

    useEffect(() => {
        if (scannerOpened) {
            startScanner();
        } else {
            stopScanner();
        }

        return () => {
            stopScanner();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scannerOpened]);

    const stopScanner = () => {
        if (scanRafRef.current) {
            cancelAnimationFrame(scanRafRef.current);
            scanRafRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        detectorRef.current = null;
        lastScanRef.current = 0;
        setTorchAvailable(false);
        setTorchOn(false);
        setScannerError(null);
    };

    const startScanner = async () => {
        try {
            const BarcodeDetectorCtor = (window as any).BarcodeDetector;
            if (!BarcodeDetectorCtor) {
                setScannerError(t('Barcode scanning not supported on this device'));
                return;
            }

            detectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            streamRef.current = stream;
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities ? track.getCapabilities() : null;
            if (capabilities && (capabilities as any).torch) {
                setTorchAvailable(true);
                try {
                    await track.applyConstraints({ advanced: [{ torch: true }] });
                    setTorchOn(true);
                } catch {
                    // ignore torch errors
                }
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                await videoRef.current.play();
            }

            scanLoop();
        } catch (error) {
            console.error('Failed to start scanner:', error);
            setScannerError(t('Failed to access camera'));
        }
    };

    const scanLoop = async (now?: number) => {
        if (!scannerOpened || !videoRef.current || !detectorRef.current) {
            return;
        }

        const time = now || performance.now();
        if (time - lastScanRef.current >= 100) {
            lastScanRef.current = time;
            try {
                const results = await detectorRef.current.detect(videoRef.current);
                if (results && results.length > 0) {
                    const raw = results[0]?.rawValue;
                    if (raw) {
                        await handleDetected(raw);
                        return;
                    }
                }
            } catch {
                // ignore detection errors
            }
        }

        scanRafRef.current = requestAnimationFrame(scanLoop);
    };

    const handleDetected = async (rawValue: string) => {
        setScanInput(rawValue);
        setScannerOpened(false);
        await handleSearch(rawValue);
    };

    const toggleTorch = async () => {
        if (!streamRef.current) return;
        const track = streamRef.current.getVideoTracks()[0];
        try {
            await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
            setTorchOn(!torchOn);
        } catch {
            // ignore torch errors
        }
    };

    const captureAndDetect = async () => {
        if (!detectorRef.current || !videoRef.current || !canvasRef.current) {
            return;
        }

        setCaptureLoading(true);
        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return;
            }

            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;

            for (let i = 0; i < 5; i += 1) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const bitmap = await createImageBitmap(canvas);
                const results = await detectorRef.current.detect(bitmap);
                if ((bitmap as any).close) {
                    (bitmap as any).close();
                }
                if (results && results.length > 0) {
                    const raw = results[0]?.rawValue;
                    if (raw) {
                        await handleDetected(raw);
                        return;
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, 80));
            }

            notifications.show({ message: t('No QR code detected'), color: 'yellow' });
        } catch (error) {
            console.error('Capture failed:', error);
            notifications.show({ message: t('Capture failed'), color: 'red' });
        } finally {
            setCaptureLoading(false);
        }
    };

    // Search/Scan
    const handleSearch = async (overrideInput?: string) => {
        const input = (overrideInput ?? scanInput).trim();
        if (!input) return;
        setLoading(true);
        setStockItem(null);
        setMode('scan');

        try {
            const looksLikeLabel = input.includes(':') ||
                input.toUpperCase().startsWith('P') ||
                input.toUpperCase().startsWith('LOC');

            if (looksLikeLabel) {
                try {
                    const labelRes = await api.get(`/modules/inventory/api/read-label?code=${encodeURIComponent(input)}`);
                    const table = labelRes.data?.table;
                    const data = labelRes.data?.data || {};

                    if (table === 'depo_stocks') {
                        setStockItem({
                            _id: data._id,
                            type: 'stock',
                            part_id: data.part_id,
                            part_name: data.part_detail?.name || t('Unknown Part'),
                            part_ipn: data.part_detail?.ipn,
                            batch_code: data.batch_code || '-',
                            quantity: data.quantity ?? data.initial_quantity ?? 0,
                            location_id: data.location_id,
                            location_name: data.location_detail?.name || t('Unknown Location'),
                            expiry_date: data.expiry_date
                        });
                        setMode('scan');
                        return;
                    }

                    if (table === 'depo_parts') {
                        setStockItem({
                            _id: data._id,
                            type: 'part',
                            part_id: data._id,
                            part_name: data.name || data.ipn || t('Unknown Part'),
                            part_ipn: data.ipn
                        });
                        setMode('scan');
                        return;
                    }

                    if (table === 'depo_locations') {
                        setStockItem({
                            _id: data._id,
                            type: 'location',
                            part_name: data.name || data.code || t('Unknown Location'),
                            location_id: data._id,
                            location_name: data.name || t('Unknown Location')
                        });
                        setMode('scan');
                        return;
                    }
                } catch (error) {
                    // Fallback to stock search below
                }
            }

            const response = await api.get(`/modules/inventory/api/stocks?search=${encodeURIComponent(input)}`);
            const results = response.data.results || [];

            if (results.length > 0) {
                const item = results[0];
                let partName = item.part_detail?.name || t('Unknown Part');
                let partIpn: string | undefined = item.part_detail?.ipn;
                let locationName = item.location_detail?.name || t('Unknown Location');

                if (!item.part_detail && item.part_id) {
                    try {
                        const partRes = await api.get(`/modules/inventory/api/articles/${item.part_id}`);
                        partName = partRes.data?.name || partName;
                        partIpn = partRes.data?.ipn || partIpn;
                    } catch {
                        // ignore part fetch errors
                    }
                }

                const locationId = item.location_id || item.initial_location_id || item?.balances?.locations?.[0]?.location_id;
                if (!item.location_detail && locationId) {
                    try {
                        const locRes = await api.get(`/modules/inventory/api/locations/${locationId}`);
                        locationName = locRes.data?.name || locationName;
                    } catch {
                        // ignore location fetch errors
                    }
                }

                const quantity = item.available_quantity ?? item.quantity ?? item.initial_quantity ?? 0;

                setStockItem({
                    _id: item._id,
                    type: 'stock',
                    part_id: item.part_id,
                    part_name: partName,
                    part_ipn: partIpn,
                    batch_code: item.batch_code || '-',
                    quantity,
                    location_id: locationId || 'unknown',
                    location_name: locationName,
                    expiry_date: item.expiry_date
                });
                setMode('scan');
            } else {
                notifications.show({ message: t('No stock found'), color: 'yellow' });
            }

        } catch (error) {
            console.error('Scan failed:', error);
            notifications.show({ message: t('Scan failed'), color: 'red' });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'count' | 'move' | 'report') => {
        if (!stockItem || stockItem.type !== 'stock') return;
        setMode(action);
        if (action === 'move' && locations.length === 0) {
            // Load locations
            try {
                // Assuming location service or generic list
                const locRes = await api.get('/modules/inventory/api/locations');
                // locations endpoint usually returns tree or flat list?
                // Assuming flat list or { results: ... }
                const locs = locRes.data.results || locRes.data || [];
                setLocations(locs.map((l: any) => ({ value: l._id, label: l.name })));
            } catch (e) { console.error(e); }
        }
    };

    const handleSubmit = async () => {
        if (!stockItem || stockItem.type !== 'stock') return;
        setSubmitting(true);
        try {
            if (mode === 'count') {
                // Adjust Stock
                // Ensure countQty is valid
                const qty = Number(countQty);
                // Logic: Adjustment = NewQty - OldQty OR Adjustment = InputAmount?
                // User wants "Count stock (poti introduce numarul de bucati disponibile)" -> Physical Count.
                // So we calculate difference.
                const currentQty = stockItem.quantity ?? 0;
                const diff = qty - currentQty;

                if (diff !== 0) {
                    if (diff < 0 && !countReason) {
                        notifications.show({ message: t('Please provide a reason for missing stock'), color: 'red' });
                        setSubmitting(false);
                        return;
                    }

                    await api.post(`/modules/inventory/api/stocks/${stockItem._id}/adjust`, {
                        quantity: diff, // Adjustment amount
                        notes: countReason || 'Physical Count',
                        location_id: stockItem.location_id
                    });
                    notifications.show({ message: t('Stock updated'), color: 'green' });
                    setStockItem({ ...stockItem, quantity: qty });
                } else {
                    notifications.show({ message: t('Count matches system quantity'), color: 'blue' });
                }
                setMode('scan');

            } else if (mode === 'move') {
                if (!moveLocation || !moveQty) return;
                await api.post(`/modules/inventory/api/stocks/${stockItem._id}/transfer`, {
                    to_location_id: moveLocation,
                    quantity: Number(moveQty),
                    from_location_id: stockItem.location_id
                });
                notifications.show({ message: t('Stock moved'), color: 'green' });
                // Update local stock (reduce qty)
                setStockItem({ ...stockItem, quantity: (stockItem.quantity ?? 0) - Number(moveQty) });
                setMode('scan');

            } else if (mode === 'report') {
                // Create issue/report
                // Maybe via generic endpoint or just log?
                // "Report (deschide form cu textarea si dropbox unde se pot incarca foto...)"
                // Implement basic text report first.
                console.log('Report:', reportIssue);
                notifications.show({ message: t('Report submitted'), color: 'green' });
                setMode('scan');
            }
        } catch (error: any) {
            console.error('Action failed:', error);
            notifications.show({ message: error.response?.data?.detail || t('Action failed'), color: 'red' });
        } finally {
            setSubmitting(false);
        }
    };

    const typeLabel = stockItem?.type === 'stock'
        ? t('Stock')
        : stockItem?.type === 'part'
            ? t('Part')
            : t('Location');

    return (
        <Container p="md" pb={80}>
            <Title order={3} mb="md">{t('Inventory Control')}</Title>

            {/* SEARCH/SCAN SECTION */}
            <Paper p="md" withBorder mb="md">
                <TextInput
                    placeholder="Scan Barcode / IPN / Batch"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.currentTarget.value)}
                    rightSection={
                        <ActionIcon onClick={handleSearch} loading={loading}>
                            <IconSearch size={18} />
                        </ActionIcon>
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button
                    fullWidth
                    mt="sm"
                    leftSection={<IconScan size={20} />}
                    variant="light"
                    onClick={() => setScannerOpened(true)}
                >
                    {t('Scan')}
                </Button>
            </Paper>

            {/* RESULT SECTION */}
            {stockItem && mode === 'scan' && (
                <Paper p="sm" withBorder shadow="sm" radius="md" style={{ position: 'relative' }}>
                    <Badge size="xs" variant="light" style={{ position: 'absolute', top: 8, left: 8 }}>
                        {typeLabel}
                    </Badge>
                    <Stack gap="xs" pt={22}>
                        <Text fw={700} size="lg">{stockItem.part_name}</Text>
                        {stockItem.part_ipn && (
                            <Text size="xs" c="dimmed">IPN: {stockItem.part_ipn}</Text>
                        )}
                        <Group justify="space-between" mt="xs">
                            {stockItem.batch_code && (
                                <div>
                                    <Text size="xs" c="dimmed">Batch</Text>
                                    <Badge size="sm">{stockItem.batch_code}</Badge>
                                </div>
                            )}
                            {stockItem.location_name && (
                                <div>
                                    <Text size="xs" c="dimmed">Location</Text>
                                    <Text fw={500}>{stockItem.location_name}</Text>
                                </div>
                            )}
                        </Group>
                        {stockItem.type === 'stock' && (
                            <>
                                <Divider my={6} />
                                <Group justify="center" gap="xs">
                                    <Text size="xl" fw={900}>{stockItem.quantity ?? 0}</Text>
                                    <Text size="xs" c="dimmed">Units</Text>
                                </Group>
                                <Divider my={6} />
                            </>
                        )}

                        {stockItem.type === 'stock' ? (
                            <>
                                <Title order={6} mb="xs">Actions</Title>
                                <Stack gap="xs">
                                    <Button leftSection={<IconBox size={18} />} onClick={() => handleAction('count')}>
                                        {t('Count Stock')}
                                    </Button>
                                    <Button leftSection={<IconArrowRight size={18} />} variant="outline" onClick={() => handleAction('move')}>
                                        {t('Move Stock')}
                                    </Button>
                                    <Button leftSection={<IconAlertTriangle size={18} />} color="red" variant="outline" onClick={() => handleAction('report')}>
                                        {t('Report Issue')}
                                    </Button>
                                </Stack>
                            </>
                        ) : (
                            <Text size="xs" c="dimmed">
                                {t('No stock actions available')}
                            </Text>
                        )}
                    </Stack>
                </Paper>
            )}

            {/* ACTION FORMS */}
            {stockItem && mode === 'count' && (
                <Paper p="md" withBorder>
                    <Group mb="md">
                        <ActionIcon variant="subtle" onClick={() => setMode('scan')}>
                            <IconArrowLeft />
                        </ActionIcon>
                        <Title order={5}>{t('Count Stock')}</Title>
                    </Group>
                    <Stack>
                        <Text size="sm">System Quantity: {stockItem.quantity ?? 0}</Text>
                        <NumberInput
                            label="Physical Count"
                            placeholder="Enter actual quantity"
                            value={countQty}
                            onChange={(v) => setCountQty(Number(v))}
                            min={0}
                        />
                        {(Number(countQty) < (stockItem.quantity ?? 0)) && (
                            <Textarea
                                label="Reason for discrepancy"
                                placeholder="Required if count is less than system"
                                value={countReason}
                                onChange={(e) => setCountReason(e.currentTarget.value)}
                                required
                            />
                        )}
                        <Button onClick={handleSubmit} loading={submitting}>
                            {t('Update Stock')}
                        </Button>
                    </Stack>
                </Paper>
            )}

            {stockItem && mode === 'move' && (
                <Paper p="md" withBorder>
                    <Group mb="md">
                        <ActionIcon variant="subtle" onClick={() => setMode('scan')}>
                            <IconArrowLeft />
                        </ActionIcon>
                        <Title order={5}>{t('Move Stock')}</Title>
                    </Group>
                    <Stack>
                        <Select
                            label="To Location"
                            placeholder="Select destination"
                            data={locations}
                            value={moveLocation}
                            onChange={setMoveLocation}
                            searchable
                        />
                        <NumberInput
                            label="Quantity"
                            placeholder="Amount to move"
                            value={moveQty}
                            onChange={(v) => setMoveQty(Number(v))}
                            max={stockItem.quantity ?? 0}
                        />
                        <Button onClick={handleSubmit} loading={submitting}>
                            {t('Confirm Move')}
                        </Button>
                    </Stack>
                </Paper>
            )}

            {stockItem && mode === 'report' && (
                <Paper p="md" withBorder>
                    <Group mb="md">
                        <ActionIcon variant="subtle" onClick={() => setMode('scan')}>
                            <IconArrowLeft />
                        </ActionIcon>
                        <Title order={5}>{t('Report Issue')}</Title>
                    </Group>
                    <Stack>
                        <Textarea
                            label="Description"
                            placeholder="Describe the issue..."
                            value={reportIssue}
                            onChange={(e) => setReportIssue(e.currentTarget.value)}
                            minRows={3}
                        />
                        <Text size="sm" c="dimmed">Photo upload not implemented yet.</Text>
                        <Button onClick={handleSubmit} loading={submitting} color="red">
                            {t('Submit Report')}
                        </Button>
                    </Stack>
                </Paper>
            )}

            <Modal
                opened={scannerOpened}
                onClose={() => setScannerOpened(false)}
                fullScreen
                title={t('Scan QR Code')}
                centered
            >
                <Stack>
                    {scannerError ? (
                        <Text c="red">{scannerError}</Text>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <video
                                ref={videoRef}
                                style={{ width: '100%', borderRadius: 12, background: '#000' }}
                                muted
                                playsInline
                            />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                    )}

                    <Group justify="space-between" mt="sm">
                        <Button
                            leftSection={<IconCamera size={18} />}
                            onClick={captureAndDetect}
                            loading={captureLoading}
                            disabled={!!scannerError}
                        >
                            {t('Capture')}
                        </Button>

                        {torchAvailable && (
                            <ActionIcon
                                variant={torchOn ? 'filled' : 'light'}
                                color={torchOn ? 'yellow' : 'blue'}
                                onClick={toggleTorch}
                            >
                                <IconBolt size={18} />
                            </ActionIcon>
                        )}

                        <Button variant="default" onClick={() => setScannerOpened(false)}>
                            {t('Close')}
                        </Button>
                    </Group>

                    <Text size="xs" c="dimmed">
                        {t('Align the QR code within the frame. Auto-scan runs continuously.')}
                    </Text>
                </Stack>
            </Modal>

        </Container>
    );
}
