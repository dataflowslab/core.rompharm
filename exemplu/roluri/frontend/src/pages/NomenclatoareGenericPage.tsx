/**
 * NomenclatoareGenericPage - Pagină generică pentru toate nomenclatoarele ALOP
 * Folosește NomenclatorDetailPage cu parametrul din URL
 */
import { useParams } from 'react-router-dom';
import { NomenclatorDetailPage } from './procurement/NomenclatorDetailPage';

export function NomenclatoareGenericPage() {
  const { table } = useParams<{ table: string }>();
  
  // Redirecționează către NomenclatorDetailPage cu parametrul table
  return <NomenclatorDetailPage />;
}

export default NomenclatoareGenericPage;
