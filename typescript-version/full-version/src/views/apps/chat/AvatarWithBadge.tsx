// React Imports
import type { MouseEvent, ReactNode, RefObject } from 'react'

// MUI Imports
import Badge from '@mui/material/Badge'
import Avatar from '@mui/material/Avatar'
import { styled } from '@mui/material/styles'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { ThemeColor } from '@core/types'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Util Imports
import { getInitials } from '@/utils/formatting/getInitials'

const BadgeContentSpan = styled('span', {
  name: 'MuiBadgeContentSpan'
})<{ color: ThemeColor; badgeSize: number }>(({ color, badgeSize }) => ({
  width: badgeSize,
  height: badgeSize,
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: color ? `var(--mui-palette-${color}-main)` : 'transparent',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
}))

type AvatarWithBadgeProps = {
  ref?: RefObject<HTMLDivElement>
  alt?: string
  src?: string
  color?: ThemeColor
  badgeColor?: ThemeColor
  badgeSize?: number
  size?: number
  isChatActive?: boolean
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  className?: string
  fallbackInitials?: string
  children?: ReactNode
}

const AvatarWithBadge = (props: AvatarWithBadgeProps) => {
  const {
    ref,
    alt,
    src,
    color,
    badgeColor,
    badgeSize,
    size,
    isChatActive,
    onClick,
    className,
    fallbackInitials,
    children
  } = props

  const styleSize = size ? { inlineSize: size, blockSize: size } : undefined

  const renderAvatar = () => {
    if (children) {
      return (
        <CustomAvatar
          ref={ref}
          color={color}
          skin={isChatActive ? 'light-static' : 'light'}
          onClick={onClick}
          className={classnames('cursor-pointer', className)}
          sx={styleSize}
        >
          {children}
        </CustomAvatar>
      )
    }

    if (src) {
      return (
        <Avatar
          ref={ref}
          alt={alt}
          src={src}
          onClick={onClick}
          className={classnames('cursor-pointer', className)}
          sx={styleSize}
        />
      )
    }

    return (
      <CustomAvatar
        ref={ref}
        color={color}
        skin={isChatActive ? 'light-static' : 'light'}
        onClick={onClick}
        className={classnames('cursor-pointer', className)}
        sx={styleSize}
      >
        {getInitials(fallbackInitials || alt || '')}
      </CustomAvatar>
    )
  }

  return (
    <Badge
      ref={ref}
      overlap='circular'
      badgeContent={badgeColor ? <BadgeContentSpan color={badgeColor} onClick={onClick} badgeSize={badgeSize || 8} /> : null}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {renderAvatar()}
    </Badge>
  )
}

export default AvatarWithBadge
