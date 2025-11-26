'use client'

/**
 * Компонент изображения с Lightbox
 * 
 * Образец для всех фото в проекте, которым нужно увеличение.
 * При наведении показывает белый плюс на затемнённом фоне.
 * При клике открывает изображение в полноэкранном Lightbox.
 * 
 * @example
 * <ImageWithLightbox
 *   src="/uploads/avatars/photo.jpg"
 *   alt="Описание фото"
 *   width={300}
 *   height={200}
 * />
 */

import { useState } from 'react'

import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Fade from '@mui/material/Fade'

interface ImageWithLightboxProps {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  borderRadius?: number | string
  className?: string
}

export default function ImageWithLightbox({
  src,
  alt,
  width = '100%',
  height = 200,
  objectFit = 'cover',
  borderRadius = 1,
  className,
}: ImageWithLightboxProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!src) return null

  return (
    <>
      {/* Image with hover overlay */}
      <Box
        onClick={() => setLightboxOpen(true)}
        className={className}
        sx={{
          width,
          height,
          borderRadius,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          position: 'relative',
          '&:hover .lightbox-overlay': {
            opacity: 1,
          },
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
          }}
        />
        
        {/* Hover overlay with plus icon */}
        <Box
          className="lightbox-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.35)',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
        >
          <i 
            className="ri-add-fill" 
            style={{ 
              fontSize: 32, 
              color: 'white',
              fontWeight: 'bold',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }} 
          />
        </Box>
      </Box>

      {/* Lightbox Dialog */}
      <Dialog
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        maxWidth={false}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            boxShadow: 'none',
            maxWidth: '95vw',
            maxHeight: '95vh',
          },
        }}
        sx={{
          '& .MuiBackdrop-root': {
            bgcolor: 'rgba(0, 0, 0, 0.9)',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Close button */}
          <IconButton
            onClick={() => setLightboxOpen(false)}
            sx={{
              position: 'absolute',
              top: -40,
              right: 0,
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <i className="ri-close-line" style={{ fontSize: 28 }} />
          </IconButton>

          {/* Full size image */}
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: '95vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
        </Box>
      </Dialog>
    </>
  )
}

