/**
 * OrdonantareForm - Form for creating ordonanțare document
 */
import { useState, useEffect } from 'react';
import {
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Table,
  ActionIcon,
  NumberInput,
  Textarea,
  Paper,
  Title,
  Text,
  Loader,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { DateInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { IconPlus, IconTrash, IconUpload, IconFile, IconX, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';
import { SSISelector } from './components/SSISelector';

interface OrdonantareFormProps {
  onSuccess?: (docId: string) => void;
  onCancel?: () => void;
  initialData?: any;
}

interface FundamentareOption {
  value: string;
  label: string;
}

interface TableRow {
  id: string;
  cod_angajament: string;
  indicator_angajament: string;
  cod_ssi: any;
  receptii: number;
  plati_anterioare: number;
  suma_ordonantata_plata: number;
  receptii_neplatite: number;
}

interface BeneficiarOption {
  value: string;
  label: string;
  denumire?: string;
  cif?: string;
  iban?: string;
  banca?: string;
}

const safeNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value).trim();
  if (!text) return 0;
  text = text.replace(/\s/g, '');
  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',') && !text.includes('.')) {
    text = text.replace(',', '.');
  }
  const parsed = parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeKey = (value: string): string => {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const buildKeyMap = (obj: Record<string, any>): Map<string, any> => {
  const map = new Map<string, any>();
  if (!obj || typeof obj !== 'object') return map;
  Object.entries(obj).forEach(([key, val]) => {
    map.set(normalizeKey(key), val);
  });
  return map;
};

const pickValue = (map: Map<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = map.get(normalizeKey(key));
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
};

const parseDateValue = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const text = String(value).trim();
  if (!text) return null;
  const shortMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (shortMatch) {
    const day = Number(shortMatch[1]);
    const month = Number(shortMatch[2]) - 1;
    const year = Number(shortMatch[3]);
    const date = new Date(year, month, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeSsiValue = (value: any) => {
  if (!value) return null;
  if (typeof value === 'object' && value.sb && value.sf && value.ssi) {
    return value;
  }
  if (typeof value === 'string') {
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 12) {
      return {
        sb: digits.slice(0, 2),
        sf: digits.slice(2, 3),
        ssi: digits.slice(3, 12),
        code: digits,
      };
    }
  }
  return null;
};

const extractSsiCode = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'object') {
    if (value.code) return String(value.code);
    if (value.sb || value.sf || value.ssi) {
      return `${value.sb || ''}${value.sf || ''}${value.ssi || ''}`;
    }
  }
  if (typeof value === 'string') {
    return value.replace(/\D/g, '') || value;
  }
  return '';
};

const buildFundamentareLineKey = (row: any): string => {
  const element = String(row?.col1 || '').trim();
  const program = String(row?.col2 || '').trim();
  const ssiCode = extractSsiCode(row?.col3);
  return `${element}|${program}|${ssiCode}`;
};

const buildOrdonantareLineKey = (row: any): string => {
  const element = String(row?.cod_angajament || '').trim();
  const program = String(row?.indicator_angajament || '').trim();
  const ssiCode = extractSsiCode(row?.cod_ssi);
  return `${element}|${program}|${ssiCode}`;
};

export function OrdonantareForm({ onSuccess, onCancel, initialData }: OrdonantareFormProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fundamentareOptions, setFundamentareOptions] = useState<FundamentareOption[]>([]);
  const [fundamentareSummary, setFundamentareSummary] = useState<{
    total_available: number;
    total_paid: number;
    remaining_total: number;
    line_paid: Record<string, number>;
    line_totals?: Record<string, number>;
    line_remaining?: Record<string, number>;
  } | null>(null);
  const [autoPopulated, setAutoPopulated] = useState(false);
  const [skipAutoPopulate, setSkipAutoPopulate] = useState(false);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);

  // Form fields
  const [nrOrdonantPl, setNrOrdonantPl] = useState('');
  const [dataOrdontPl, setDataOrdontPl] = useState<Date | null>(new Date());
  const [fundamentareId, setFundamentareId] = useState<string | null>(null);
  const [beneficiar, setBeneficiar] = useState('');
  const [documenteJustificative, setDocumenteJustificative] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file_id: string; filename: string; display_name: string }>>([]);
  const [ibanBeneficiar, setIbanBeneficiar] = useState('');
  const [cifBeneficiar, setCifBeneficiar] = useState('');
  const [bancaBeneficiar, setBancaBeneficiar] = useState('');
  const [beneficiarOptions, setBeneficiarOptions] = useState<BeneficiarOption[]>([]);
  const [beneficiarSelect, setBeneficiarSelect] = useState<string | null>(null);
  const [beneficiarSearch, setBeneficiarSearch] = useState('');
  const [loadingBeneficiari, setLoadingBeneficiari] = useState(false);
  const [loadingAnaf, setLoadingAnaf] = useState(false);
  const [infPvPlata, setInfPvPlata] = useState('');
  const [infPvPlata1, setInfPvPlata1] = useState('');
  const [tabel, setTabel] = useState<TableRow[]>([]);
  const [debouncedBeneficiarSearch] = useDebouncedValue(beneficiarSearch, 300);

  useEffect(() => {
    loadFundamentare();
    generateNextNumber();
    loadBeneficiari('');
  }, []);

  useEffect(() => {
    loadBeneficiari(debouncedBeneficiarSearch);
  }, [debouncedBeneficiarSearch]);

  useEffect(() => {
    if (fundamentareId) {
      loadFundamentareDetailsAndSummary(fundamentareId, !skipAutoPopulate);
      if (skipAutoPopulate) {
        setSkipAutoPopulate(false);
      }
    } else {
      setTabel([]);
      setFundamentareSummary(null);
      setAutoPopulated(false);
    }
  }, [fundamentareId, skipAutoPopulate]);

  const loadFundamentare = async () => {
    try {
      const response = await api.get('/api/procurement/fundamentare/approved/list');
      setFundamentareOptions(response.data);
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca documentele de fundamentare',
        color: 'red',
      });
    }
  };

  const resolveFundamentareId = (rawValue: string): string | null => {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) return null;
    const direct = fundamentareOptions.find((opt) => opt.value === trimmed);
    if (direct) return direct.value;
    const byLabel = fundamentareOptions.find((opt) => (opt.label || '').includes(trimmed));
    if (byLabel) return byLabel.value;
    const isObjectId = /^[a-f0-9]{24}$/i.test(trimmed);
    return fundamentareOptions.length === 0 && isObjectId ? trimmed : null;
  };

  const mapImportedRows = (rows: any[]): TableRow[] => {
    return rows.map((row) => {
      const rowMap = buildKeyMap(row || {});
      const codAngajament = pickValue(rowMap, [
        'cod_angajament',
        'codangajament',
        'cod angajament',
        'cod_angaj',
        'element',
        'element_fundamentare',
      ]) || '';
      const indicator = pickValue(rowMap, [
        'indicator_angajament',
        'indicator',
        'program',
        'cod_program',
        'codprogram',
      ]) || '';
      const codSsiRaw = pickValue(rowMap, [
        'cod_ssi',
        'codssi',
        'ssi',
        'cod ssi',
        'codssi1',
      ]);
      const receptiiValue = pickValue(rowMap, ['receptii', 'receptii_lei', 'valoare', 'total']);
      const platiValue = pickValue(rowMap, ['plati_anterioare', 'platiant', 'plati', 'plati_ant']);
      const sumaValue = pickValue(rowMap, [
        'suma_ordonantata_plata',
        'suma',
        'sumaordonantata',
        'suma_de_plata',
        'suma_plata',
      ]);
      const receptiiNeplatiteRaw = pickValue(rowMap, [
        'receptii_neplatite',
        'receptiineplatite',
        'rest',
        'rest_de_plata',
      ]);

      const receptii = safeNumber(receptiiValue);
      const plati = safeNumber(platiValue);
      const suma = safeNumber(sumaValue);
      const receptiiNeplatite = receptiiNeplatiteRaw !== undefined
        ? safeNumber(receptiiNeplatiteRaw)
        : receptii - plati - suma;

      return {
        id: `${Date.now().toString()}-${Math.random()}`,
        cod_angajament: String(codAngajament || ''),
        indicator_angajament: String(indicator || ''),
        cod_ssi: normalizeSsiValue(codSsiRaw),
        receptii,
        plati_anterioare: plati,
        suma_ordonantata_plata: suma,
        receptii_neplatite: receptiiNeplatite,
      };
    });
  };

  const applyJsonData = (payload: any) => {
    if (!payload || typeof payload !== 'object') {
      notifications.show({
        title: 'Eroare',
        message: 'Fișierul JSON nu conține date valide.',
        color: 'red',
      });
      return;
    }

    const root = payload.ordonantare || payload.data || payload;
    const merged = {
      ...(typeof root === 'object' ? root : {}),
      ...(root?.header || {}),
      ...(root?.meta || {}),
      ...(root?.document || {}),
    };

    const map = buildKeyMap(merged);

    const nrValue = pickValue(map, [
      'nr_ordonant_pl',
      'nrordonantpl',
      'nr_ordonanta_plata',
      'nr_ordonanta',
      'nr_ordonantare',
      'nr',
      'numar',
    ]);
    if (nrValue !== undefined) {
      setNrOrdonantPl(String(nrValue).trim());
    }

    const dateValue = pickValue(map, [
      'data_ordont_pl',
      'data_ordonant_pl',
      'data_ordonanta',
      'data_ordonantare',
      'data',
    ]);
    const parsedDate = parseDateValue(dateValue);
    if (parsedDate) {
      setDataOrdontPl(parsedDate);
    }

    const fundamentareValue = pickValue(map, [
      'fundamentare_id',
      'fundamentareid',
      'fundamentare',
      'fundamentare_nr',
      'nr_fundamentare',
      'nr_inreg_fundamentare',
      'fundamentare_nr_inreg',
    ]);
    if (fundamentareValue !== undefined) {
      const resolved = resolveFundamentareId(String(fundamentareValue));
      if (resolved) {
        setSkipAutoPopulate(true);
        setFundamentareId(resolved);
      } else {
        notifications.show({
          title: 'Atenție',
          message: `Documentul de fundamentare (${String(fundamentareValue)}) nu a fost găsit în listă.`,
          color: 'yellow',
        });
      }
    }

    const beneficiarValue = pickValue(map, ['beneficiar', 'denumire_beneficiar', 'furnizor', 'denumire']);
    if (beneficiarValue !== undefined) {
      setBeneficiar(String(beneficiarValue));
      setBeneficiarSelect(null);
    }
    const cifValue = pickValue(map, ['cif', 'cui', 'cod_fiscal', 'cif_beneficiar']);
    if (cifValue !== undefined) {
      setCifBeneficiar(String(cifValue));
    }
    const ibanValue = pickValue(map, ['iban', 'iban_beneficiar']);
    if (ibanValue !== undefined) {
      setIbanBeneficiar(String(ibanValue));
    }
    const bancaValue = pickValue(map, ['banca', 'banca_beneficiar']);
    if (bancaValue !== undefined) {
      setBancaBeneficiar(String(bancaValue));
    }
    const docValue = pickValue(map, [
      'documente_justificative',
      'documente',
      'documentejustificative',
      'opis',
    ]);
    if (docValue !== undefined) {
      setDocumenteJustificative(String(docValue));
    }
    const pvValue = pickValue(map, ['inf_pv_plata', 'pv_plata', 'informatii_pv_plata']);
    if (pvValue !== undefined) {
      setInfPvPlata(String(pvValue));
    }
    const pvValue1 = pickValue(map, ['inf_pv_plata1', 'pv_plata1', 'informatii_pv_plata1']);
    if (pvValue1 !== undefined) {
      setInfPvPlata1(String(pvValue1));
    }

    let tableCandidate: any = pickValue(map, [
      'tabel',
      'tabel_angajamente',
      'angajamente',
      'linii',
      'rows',
      'items',
      'detalii',
    ]);
    if (!tableCandidate && root && typeof root === 'object') {
      tableCandidate = root.tabel || root.tabel_angajamente || root.linii || root.rows || root.items;
    }

    let rows: any[] = [];
    if (Array.isArray(tableCandidate)) {
      rows = tableCandidate;
    } else if (tableCandidate && typeof tableCandidate === 'object') {
      if (Array.isArray(tableCandidate.rows)) rows = tableCandidate.rows;
      else if (Array.isArray(tableCandidate.items)) rows = tableCandidate.items;
      else if (Array.isArray(tableCandidate.linii)) rows = tableCandidate.linii;
    }

    if (rows.length > 0) {
      setTabel(mapImportedRows(rows));
      setAutoPopulated(false);
    }

    notifications.show({
      title: 'Succes',
      message: 'Datele au fost preluate din fișierul JSON.',
      color: 'green',
    });
  };

  const applyXmlData = (xmlText: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const parseErrors = doc.getElementsByTagName('parsererror');
      if (parseErrors && parseErrors.length > 0) {
        throw new Error('parsererror');
      }

      const ns = 'urn:crystal-reports:schemas:report-detail';
      const textNodes = Array.from(doc.getElementsByTagNameNS(ns, 'TextValue'));
      const textValues = textNodes
        .map((node) => (node.textContent || '').trim())
        .filter((value) => value.length > 0);

      const combinedText = textValues.join('\n');
      const headerMatch = combinedText.match(/nr\.?\s*([A-Za-z0-9\-\/]+)\s*\/\s*data\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4})/i);
      if (headerMatch) {
        const rawNumber = headerMatch[1]?.trim() || '';
        if (/^\d+$/.test(rawNumber)) {
          setNrOrdonantPl(`ORD-${rawNumber.padStart(4, '0')}`);
        } else if (rawNumber) {
          setNrOrdonantPl(rawNumber);
        }
        const parsedDate = parseDateValue(headerMatch[2]);
        if (parsedDate) {
          setDataOrdontPl(parsedDate);
        }
      }

      const fundMatch = combinedText.match(/fundamentare:\s*([A-Za-z0-9\-\/]+)/i);
      if (fundMatch?.[1]) {
        const resolved = resolveFundamentareId(fundMatch[1]);
        if (resolved) {
          setSkipAutoPopulate(true);
          setFundamentareId(resolved);
        }
      }

      const lines = combinedText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        if (line.toLowerCase().startsWith('beneficiar:')) {
          setBeneficiar(line.split(':').slice(1).join(':').trim());
          setBeneficiarSelect(null);
        } else if (line.toLowerCase().startsWith('documente justificative:')) {
          setDocumenteJustificative(line.split(':').slice(1).join(':').trim());
        } else if (line.toLowerCase().startsWith('cod de identificare fiscala beneficiar:')) {
          setCifBeneficiar(line.split(':').slice(1).join(':').trim());
        } else if (line.toLowerCase().startsWith('cod iban beneficiar:')) {
          setIbanBeneficiar(line.split(':').slice(1).join(':').trim());
        } else if (line.toLowerCase().startsWith('cont deschis la:')) {
          setBancaBeneficiar(line.split(':').slice(1).join(':').trim());
        } else if (line.toLowerCase().startsWith('informatii privind plata:')) {
          setInfPvPlata(line.split(':').slice(1).join(':').trim());
        } else if (line.toLowerCase().startsWith('informatii privind plata 1:')) {
          setInfPvPlata1(line.split(':').slice(1).join(':').trim());
        }
      }

      const fieldNodes = Array.from(doc.getElementsByTagNameNS(ns, 'Field'));
      const rowMap: Record<string, Record<string, string>> = {};

      fieldNodes.forEach((field) => {
        const name = field.getAttribute('Name') || '';
        if (!name || name.startsWith('Sumof')) return;
        const match = name.match(/(CodAngajament|IndicatorAngajament|CodProgram|CodSSI|ReceptiiNeplatite|Receptii|PlatiAnt|Suma)(\d+)$/i);
        if (!match) return;
        const key = match[1];
        const index = match[2];
        const valueNode = field.getElementsByTagNameNS(ns, 'Value')[0];
        const value = (valueNode?.textContent || '').trim();
        if (!rowMap[index]) rowMap[index] = {};
        rowMap[index][key] = value;
      });

      const indices = Object.keys(rowMap)
        .map((idx) => Number(idx))
        .filter((idx) => Number.isFinite(idx))
        .sort((a, b) => a - b)
        .map((idx) => String(idx));

      if (indices.length > 0) {
        const rows: TableRow[] = indices.map((idx) => {
          const data = rowMap[idx] || {};
          const indicator = data.IndicatorAngajament || data.CodProgram || '';
          const receptii = safeNumber(data.Receptii);
          const plati = safeNumber(data.PlatiAnt);
          const suma = safeNumber(data.Suma);
          const receptiiNeplatite = data.ReceptiiNeplatite !== undefined
            ? safeNumber(data.ReceptiiNeplatite)
            : receptii - plati - suma;
          return {
            id: `${Date.now().toString()}-${Math.random()}`,
            cod_angajament: data.CodAngajament || '',
            indicator_angajament: indicator,
            cod_ssi: normalizeSsiValue(data.CodSSI),
            receptii,
            plati_anterioare: plati,
            suma_ordonantata_plata: suma,
            receptii_neplatite: receptiiNeplatite,
          };
        });

        setTabel(rows);
        setAutoPopulated(false);
      }

      notifications.show({
        title: 'Succes',
        message: 'Datele au fost preluate din fișierul XML.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut citi fișierul XML.',
        color: 'red',
      });
    }
  };

  const handleImportDrop = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const text = await file.text();
      setImportedFileName(file.name);
      if (text.trim().startsWith('<')) {
        applyXmlData(text);
      } else {
        const payload = JSON.parse(text);
        applyJsonData(payload);
      }
    } catch (error) {
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-a putut citi fișierul de import.',
        color: 'red',
      });
    }
  };

  const loadBeneficiari = async (search: string) => {
    setLoadingBeneficiari(true);
    try {
      const response = await api.get('/api/procurement/ordonantare/beneficiari', {
        params: {
          search: search || undefined,
          limit: 20,
        }
      });
      setBeneficiarOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load beneficiaries:', error);
      setBeneficiarOptions([]);
    } finally {
      setLoadingBeneficiari(false);
    }
  };

  const applyBeneficiarOption = (option?: BeneficiarOption) => {
    if (!option) return;
    if (option.denumire || option.label) {
      setBeneficiar(option.denumire || option.label);
    }
    if (option.cif) {
      setCifBeneficiar(option.cif);
    }
    if (option.iban) {
      setIbanBeneficiar(option.iban);
    }
    if (option.banca) {
      setBancaBeneficiar(option.banca);
    }
  };

  const handleBeneficiarSelect = (value: string | null) => {
    setBeneficiarSelect(value);
    if (!value) return;
    const option = beneficiarOptions.find((opt) => opt.value === value);
    applyBeneficiarOption(option);
  };

  const handleAnafLookup = async () => {
    const cif = (cifBeneficiar || '').trim();
    if (!cif) {
      notifications.show({
        title: 'Eroare',
        message: 'Introduceți CUI/CIF pentru verificare ANAF',
        color: 'red',
      });
      return;
    }
    try {
      setLoadingAnaf(true);
      const response = await api.get(`/api/procurement/companii/anaf/verify/${encodeURIComponent(cif)}`);
      if (!response.data?.found) {
        notifications.show({
          title: 'Informație',
          message: response.data?.message || 'CIF nu a fost găsit în baza de date ANAF',
          color: 'yellow',
        });
        return;
      }
      const data = response.data?.data || {};
      if (data.denumire) setBeneficiar(data.denumire);
      if (data.cui) setCifBeneficiar(data.cui);
      if (data.iban) setIbanBeneficiar(data.iban);
      if (data.banca) setBancaBeneficiar(data.banca);
      notifications.show({
        title: 'Succes',
        message: 'Date preluate cu succes din ANAF',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-au putut prelua datele din ANAF',
        color: 'red',
      });
    } finally {
      setLoadingAnaf(false);
    }
  };

  const loadFundamentareDetailsAndSummary = async (id: string, applyTable: boolean = true) => {
    try {
      const [fundResponse, summaryResponse] = await Promise.all([
        api.get(`/api/procurement/fundamentare/${id}`),
        api.get(`/api/procurement/ordonantare/fundamentare/${id}/summary`)
      ]);

      const formData = fundResponse.data?.form_data || {};
      const tabel1 = Array.isArray(formData.tabel1) ? formData.tabel1 : [];
      const linePaid = summaryResponse.data?.line_paid || {};

      if (applyTable) {
        const newRows: TableRow[] = tabel1.map((row: any) => {
          const ssiValue = normalizeSsiValue(row.col3);
          const totalLine = safeNumber(row.col7);
          const lineKey = buildFundamentareLineKey(row);
          const paid = safeNumber(linePaid[lineKey]);
          const remaining = totalLine - paid;

          return {
            id: `${Date.now().toString()}-${Math.random()}`,
            cod_angajament: row.col1 || '',
            indicator_angajament: row.col2 || '',
            cod_ssi: ssiValue,
            receptii: totalLine,
            plati_anterioare: paid,
            suma_ordonantata_plata: 0,
            receptii_neplatite: remaining,
          };
        });

        if (tabel1.length > 0) {
          setTabel(newRows);
          setAutoPopulated(true);
        } else {
          setTabel([]);
          setAutoPopulated(false);
        }
      } else {
        setAutoPopulated(false);
        setTabel((current) => current.map((row) => {
          const lineKey = buildOrdonantareLineKey(row);
          const paid = safeNumber(linePaid[lineKey]);
          const receptii = safeNumber(row.receptii);
          const ordonantate = safeNumber(row.suma_ordonantata_plata);
          return {
            ...row,
            plati_anterioare: paid,
            receptii_neplatite: receptii - paid - ordonantate,
          };
        }));
      }

      setFundamentareSummary({
        total_available: safeNumber(summaryResponse.data?.total_available),
        total_paid: safeNumber(summaryResponse.data?.total_paid),
        remaining_total: safeNumber(summaryResponse.data?.remaining_total),
        line_paid: linePaid,
        line_totals: summaryResponse.data?.line_totals || undefined,
        line_remaining: summaryResponse.data?.line_remaining || undefined,
      });
    } catch (error: any) {
      console.error('Failed to load fundamentare details:', error);
      notifications.show({
        title: 'Eroare',
        message: 'Nu s-au putut încărca datele fundamentării',
        color: 'red',
      });
      setTabel([]);
      setFundamentareSummary(null);
      setAutoPopulated(false);
    }
  };

  const generateNextNumber = async () => {
    try {
      const response = await api.get('/api/procurement/ordonantare');
      const docs = response.data.documents || [];
      const lastNumber = docs.length > 0 ? parseInt(docs[0].nr_ordonant_pl.split('-')[1]) : 0;
      setNrOrdonantPl(`ORD-${String(lastNumber + 1).padStart(4, '0')}`);
    } catch (error) {
      setNrOrdonantPl('ORD-0001');
    }
  };

  const addRow = () => {
    if (autoPopulated) {
      return;
    }
    setTabel([
      ...tabel,
      {
        id: Date.now().toString(),
        cod_angajament: '',
        indicator_angajament: '',
        cod_ssi: null,
        receptii: 0,
        plati_anterioare: 0,
        suma_ordonantata_plata: 0,
        receptii_neplatite: 0,
      },
    ]);
  };

  const removeRow = (id: string) => {
    setTabel(tabel.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, field: string, value: any) => {
    setTabel(
      tabel.map((row) => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };
          if (fundamentareSummary && ['cod_angajament', 'indicator_angajament', 'cod_ssi'].includes(field)) {
            const lineKey = buildOrdonantareLineKey(updated);
            const paid = safeNumber(fundamentareSummary.line_paid?.[lineKey]);
            updated.plati_anterioare = paid;
          }
          const receptii = safeNumber(updated.receptii);
          const platite = safeNumber(updated.plati_anterioare);
          const ordonantate = safeNumber(updated.suma_ordonantata_plata);
          updated.receptii_neplatite = receptii - platite - ordonantate;
          return updated;
        }
        return row;
      })
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (!nrOrdonantPl || !dataOrdontPl || !fundamentareId) {
      notifications.show({
        title: 'Eroare',
        message: 'Completați toate câmpurile obligatorii',
        color: 'red',
      });
      return;
    }

    if (tabel.length === 0) {
      notifications.show({
        title: 'Eroare',
        message: 'Adăugați cel puțin o linie în tabel',
        color: 'red',
      });
      return;
    }
    const totalNou = tabel.reduce((sum, row) => sum + safeNumber(row.suma_ordonantata_plata), 0);
    const perLineErrors = tabel.filter((row) => {
      const receptii = safeNumber(row.receptii);
      const platite = safeNumber(row.plati_anterioare);
      const ordonantate = safeNumber(row.suma_ordonantata_plata);
      return ordonantate > receptii - platite + 0.0001;
    });

    if (perLineErrors.length > 0) {
      notifications.show({
        title: 'Eroare',
        message: 'Există linii unde suma ordonantată depășește suma rămasă.',
        color: 'red',
      });
      return;
    }
    if (fundamentareSummary && totalNou > fundamentareSummary.remaining_total + 0.0001) {
      notifications.show({
        title: 'Eroare',
        message: `Suma ordonantată (${totalNou.toFixed(2)}) depășește suma rămasă (${fundamentareSummary.remaining_total.toFixed(2)}).`,
        color: 'red',
      });
      return;
    }
    try {
      setLoading(true);

      const payload = {
        nr_ordonant_pl: nrOrdonantPl,
        data_ordont_pl: dataOrdontPl.toISOString(),
        fundamentare_id: fundamentareId,
        beneficiar,
        documente_justificative: documenteJustificative,
        uploaded_files: uploadedFiles.map(f => f.file_id),
        iban_beneficiar: ibanBeneficiar,
        cif_beneficiar: cifBeneficiar,
        banca_beneficiar: bancaBeneficiar,
        inf_pv_plata: infPvPlata,
        inf_pv_plata1: infPvPlata1,
        form_data: {
          tabel,
        },
      };

      const response = await api.post('/api/procurement/ordonantare', payload);

      notifications.show({
        title: 'Succes',
        message: 'Ordonanțare creată cu succes',
        color: 'green',
      });

      if (onSuccess) {
        onSuccess(response.data.id);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Eroare',
        message: error.response?.data?.detail || 'Nu s-a putut crea documentul',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="sm">
      <Paper withBorder p="sm">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Import XML/JSON Ordonanțare</Text>
          {importedFileName && (
            <Text size="xs" c="dimmed">
              {importedFileName}
            </Text>
          )}
        </Group>
        <Dropzone
          onDrop={handleImportDrop}
          maxFiles={1}
          accept={['application/json', 'application/xml', 'text/xml']}
        >
          <Group justify="center" gap="xs" style={{ minHeight: 80, pointerEvents: 'none' }}>
            <Dropzone.Accept>
              <IconUpload size={32} stroke={1.5} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX size={32} stroke={1.5} />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconFile size={32} stroke={1.5} />
            </Dropzone.Idle>
            <div>
              <Text size="sm" inline>
                Trage aici un fișier XML/JSON sau dă click pentru încărcare
              </Text>
              <Text size="xs" c="dimmed" inline mt={4}>
                Se vor prelua automat câmpurile disponibile
              </Text>
            </div>
          </Group>
        </Dropzone>
      </Paper>

      {/* Basic Info */}
      <Group grow>
        <TextInput
          label="Nr. Ordonanță Plată"
          value={nrOrdonantPl}
          onChange={(e) => setNrOrdonantPl(e.target.value)}
          required
          readOnly
        />
        <DateInput
          label="Data Ordonanță Plată"
          value={dataOrdontPl}
          onChange={setDataOrdontPl}
          valueFormat="DD/MM/YYYY"
          required
        />
      </Group>

      <Select
        label="Document Fundamentare"
        placeholder="Selectează fundamentare"
        data={fundamentareOptions}
        value={fundamentareId}
        onChange={setFundamentareId}
        searchable
        required
      />
      {fundamentareSummary && (
        <Paper withBorder p="sm">
          <Group justify="space-between">
            <TextInput
              label="Total disponibil"
              value={fundamentareSummary.total_available.toFixed(2)}
              disabled
            />
            <TextInput
              label="Total plătit anterior"
              value={fundamentareSummary.total_paid.toFixed(2)}
              disabled
            />
            <TextInput
              label="Suma rămasă"
              value={fundamentareSummary.remaining_total.toFixed(2)}
              disabled
            />
          </Group>
        </Paper>
      )}

      {/* Beneficiar Info */}
      <Group grow>
        <Select
          label="Alege beneficiarul"
          placeholder="Caută beneficiar"
          data={beneficiarOptions}
          value={beneficiarSelect}
          onChange={handleBeneficiarSelect}
          searchable
          clearable
          searchValue={beneficiarSearch}
          onSearchChange={setBeneficiarSearch}
          nothingFoundMessage="Nu există beneficiari"
          disabled={loadingBeneficiari}
        />
        <TextInput
          label="Denumire beneficiar"
          value={beneficiar}
          onChange={(e) => setBeneficiar(e.target.value)}
          required
        />
        <TextInput
          label="CIF beneficiar"
          value={cifBeneficiar}
          onChange={(e) => setCifBeneficiar(e.target.value)}
          required
          rightSection={
            <Tooltip label="Preia date din ANAF" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={handleAnafLookup}
                disabled={loadingAnaf}
              >
                {loadingAnaf ? <Loader size={16} /> : <IconSearch size={16} />}
              </ActionIcon>
            </Tooltip>
          }
          rightSectionWidth={36}
        />
      </Group>

      <Group grow>
        <TextInput
          label="IBAN beneficiar"
          value={ibanBeneficiar}
          onChange={(e) => setIbanBeneficiar(e.target.value)}
          required
        />
        <TextInput
          label="Banca beneficiar"
          value={bancaBeneficiar}
          onChange={(e) => setBancaBeneficiar(e.target.value)}
          required
        />
      </Group>

      {/* Documente Justificative - Text Description */}
      <Textarea
        label="Documente Justificative (Opis)"
        placeholder="Ex: 1. Factură nr. 123/2025, 2. Contract nr. 456/2024"
        value={documenteJustificative}
        onChange={(e) => setDocumenteJustificative(e.target.value)}
        rows={2}
        description="Descriere documentelor (max 90 caractere pentru XML) - Opțional"
        maxLength={90}
      />

      {/* Atașare Fișiere */}
      <div>
        <Text size="sm" fw={500} mb="xs">
          Atașare Fișiere
        </Text>
        <Group align="flex-start">
          <Dropzone
            onDrop={async (files) => {
              try {
                setUploading(true);
                const uploaded: Array<{ file_id: string; filename: string; display_name: string }> = [];

                for (const file of files) {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('title', file.name);
                  formData.append('main', 'false');

                  const response = await api.post('/api/library/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });

                  // Remove extension from filename for display name
                  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

                  uploaded.push({
                    file_id: response.data._id,
                    filename: file.name,
                    display_name: nameWithoutExt,
                  });
                }

                setUploadedFiles([...uploadedFiles, ...uploaded]);

                notifications.show({
                  title: 'Succes',
                  message: `${files.length} fișier(e) încărcat(e)`,
                  color: 'green',
                });
              } catch (error) {
                console.error('Failed to upload files:', error);
                notifications.show({
                  title: 'Eroare',
                  message: 'Nu s-au putut încărca fișierele',
                  color: 'red',
                });
              } finally {
                setUploading(false);
              }
            }}
            loading={uploading}
            multiple
          >
            <Group justify="center" gap="xs" style={{ minHeight: 80, pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload size={32} stroke={1.5} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={32} stroke={1.5} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconFile size={32} stroke={1.5} />
              </Dropzone.Idle>
              <div>
                <Text size="sm" inline>
                  Încarcă documente justificative
                </Text>
                <Text size="xs" c="dimmed" inline mt={4}>
                  Poți încărca multiple fișiere
                </Text>
              </div>
            </Group>
          </Dropzone>

          <Paper withBorder p="sm" style={{ minHeight: 80, flex: 1 }}>
            <Text size="xs" fw={500} mb="xs">Fișiere încărcate</Text>
            {uploadedFiles.length === 0 ? (
              <Text size="xs" c="dimmed">Niciun fișier încărcat</Text>
            ) : (
              <Stack gap="sm">
                {uploadedFiles.map((file, index) => (
                  <Paper key={file.file_id} withBorder p="xs" bg="gray.0">
                    <Stack gap="xs">
                      <Group justify="space-between" gap="xs">
                        <Text size="xs" c="dimmed" style={{ fontSize: '10px' }}>
                          {file.filename}
                        </Text>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => setUploadedFiles(uploadedFiles.filter(f => f.file_id !== file.file_id))}
                        >
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Group>
                      <TextInput
                        size="xs"
                        placeholder="Denumire document"
                        value={file.display_name}
                        onChange={(e) => {
                          const updated = [...uploadedFiles];
                          updated[index].display_name = e.target.value;
                          setUploadedFiles(updated);
                        }}
                        label={`${index + 1}. Denumire`}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Group>
      </div>

      <Group grow>
        <TextInput
          label="Informații PV Plată"
          value={infPvPlata}
          onChange={(e) => setInfPvPlata(e.target.value)}
        />
        <TextInput
          label="Informații PV Plată 1"
          value={infPvPlata1}
          onChange={(e) => setInfPvPlata1(e.target.value)}
        />
      </Group>

      {/* Table */}
      <div>
        <Group justify="space-between" mb="xs">
          <Title order={5}>Tabel Angajamente</Title>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addRow} disabled={autoPopulated}>
            Adaugă Linie
          </Button>
        </Group>

        <Paper withBorder p="xs">
          <Table striped withTableBorder fontSize="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cod Angajament</Table.Th>
                <Table.Th>Indicator</Table.Th>
                <Table.Th>Cod SSI</Table.Th>
                <Table.Th>Recepții</Table.Th>
                <Table.Th>Plăți Ant.</Table.Th>
                <Table.Th>Sumă Ord.</Table.Th>
                <Table.Th>Rec. Nepl.</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tabel.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      value={row.cod_angajament}
                      onChange={(e) => updateRow(row.id, 'cod_angajament', e.target.value)}
                      readOnly={autoPopulated}
                    />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      size="xs"
                      value={row.indicator_angajament}
                      onChange={(e) => updateRow(row.id, 'indicator_angajament', e.target.value)}
                      readOnly={autoPopulated}
                    />
                  </Table.Td>
                  <Table.Td>
                    <SSISelector
                      value={row.cod_ssi}
                      onChange={(value) => updateRow(row.id, 'cod_ssi', value)}
                      disabled={autoPopulated}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={row.receptii}
                      onChange={(value) => updateRow(row.id, 'receptii', value || 0)}
                      readOnly={autoPopulated}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={row.plati_anterioare}
                      readOnly
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput
                      size="xs"
                      value={row.suma_ordonantata_plata}
                      onChange={(value) => updateRow(row.id, 'suma_ordonantata_plata', value || 0)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <NumberInput size="xs" value={row.receptii_neplatite} disabled />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon size="sm" color="red" onClick={() => removeRow(row.id)}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
                {tabel.length > 0 && (
                  <Table.Tr>
                    <Table.Td fw={700}>TOTAL</Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td></Table.Td>
                    <Table.Td fw={700}>
                      {tabel.reduce((sum, row) => sum + safeNumber(row.receptii), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {tabel.reduce((sum, row) => sum + safeNumber(row.plati_anterioare), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {tabel.reduce((sum, row) => sum + safeNumber(row.suma_ordonantata_plata), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fw={700}>
                      {tabel.reduce((sum, row) => sum + safeNumber(row.receptii_neplatite), 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td></Table.Td>
                  </Table.Tr>
                )}
            </Table.Tbody>
          </Table>

          {tabel.length === 0 && (
            <Text c="dimmed" ta="center" py="md" size="sm">
              Nu există linii. Adăugați prima linie.
            </Text>
          )}
        </Paper>
      </div>

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={onCancel}>
          Anulează
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          Salvează
        </Button>
      </Group>
    </Stack>
  );
}








