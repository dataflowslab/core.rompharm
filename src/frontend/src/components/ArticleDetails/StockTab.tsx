import { Button, LoadingOverlay, Table, Text, Badge } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

interface StockTabProps {
  stocks: any[];
  loadingStocks: boolean;
  articleUm: string;
  onAddStock: () => void;
}

export function StockTab({ stocks, loadingStocks, articleUm, onAddStock }: StockTabProps) {
  const navigate = useNavigate();

  return (
    <>
      <Button mb="md" onClick={onAddStock}>
        Add Stock
      </Button>

      {loadingStocks && <LoadingOverlay visible />}

      {stocks.length === 0 && !loadingStocks && (
        <Text c="dimmed">No stock items found for this article.</Text>
      )}

      {stocks.length > 0 && !loadingStocks && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Batch Code</Table.Th>
              <Table.Th>Batch Date</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Stock Value</Table.Th>
              <Table.Th>Supplier</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stocks.map((stock: any) => (
              <Table.Tr 
                key={stock._id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/inventory/stocks/${stock._id}`)}
              >
                <Table.Td>{stock.batch_code || '-'}</Table.Td>
                <Table.Td>
                  {stock.batch_date ? new Date(stock.batch_date).toLocaleDateString() : '-'}
                </Table.Td>
                <Table.Td>
                  {stock.status_detail ? (
                    <Badge
                      style={{
                        backgroundColor: stock.status_detail.color || '#gray',
                        color: '#fff',
                      }}
                    >
                      {stock.status_detail.name}
                    </Badge>
                  ) : (
                    <Badge color="gray">{stock.status || 'Unknown'}</Badge>
                  )}
                </Table.Td>
                <Table.Td>{stock.location_detail?.name || '-'}</Table.Td>
                <Table.Td>{stock.quantity || 0} {articleUm}</Table.Td>
                <Table.Td>{stock.stock_value ? `${stock.stock_value.toFixed(2)} EUR` : '-'}</Table.Td>
                <Table.Td>{stock.supplier_name || '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
