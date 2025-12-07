import { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface SecureImageProps {
  fileId: string;
  alt: string;
  style?: React.CSSProperties;
  onError?: () => void;
}

export function SecureImage({ fileId, alt, style, onError }: SecureImageProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const response = await api.get(`/api/library/files/${fileId}/download`, {
          responseType: 'blob',
        });
        
        if (mounted) {
          objectUrl = URL.createObjectURL(response.data);
          setImageUrl(objectUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load image:', err);
        if (mounted) {
          setError(true);
          setLoading(false);
          if (onError) onError();
        }
      }
    };

    loadImage();

    // Cleanup
    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [fileId, onError]);

  if (loading) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa' }}>
        <span style={{ color: '#868e96', fontSize: '12px' }}>...</span>
      </div>
    );
  }

  if (error || !imageUrl) {
    return null;
  }

  return <img src={imageUrl} alt={alt} style={style} />;
}
