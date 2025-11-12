// React Imports
import { useRef } from 'react'

// Next Imports
import Link from 'next/link'
import { useParams } from 'next/navigation'

// MUI Imports
import { styled } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { ChildrenType, ScrollMenuHandler } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import NavHeader from '@menu/components/vertical-menu/NavHeader'
import Logo from '@components/layout/shared/Logo'
import NavCollapseIcons from '@menu/components/vertical-menu/NavCollapseIcons'

// Hook Imports
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

// Util Imports
import { mapHorizontalToVerticalMenu } from '@menu/utils/menuUtils'
import { getLocalizedUrl } from '@/utils/formatting/i18n'

const StyledBoxForShadow = styled('div')(({ theme }) => ({
  top: 60,
  left: -8,
  zIndex: 2,
  opacity: 0,
  position: 'absolute',
  pointerEvents: 'none',
  width: 'calc(100% + 15px)',
  height: theme.mixins.toolbar.minHeight,
  transition: 'opacity .15s ease-in-out',
  background: `linear-gradient(var(--mui-palette-background-default) ${
    theme.direction === 'rtl' ? '95%' : '5%'
  }, rgb(var(--mui-palette-background-defaultChannel) / 0.85) 30%, rgb(var(--mui-palette-background-defaultChannel) / 0.5) 65%, rgb(var(--mui-palette-background-defaultChannel) / 0.3) 75%, transparent)`,
  '&.scrolled': {
    opacity: 1
  }
}))

const VerticalNavContent = ({ children }: ChildrenType) => {
  // Hooks
  const { isBreakpointReached } = useHorizontalNav()
  const { lang: locale } = useParams()
  const safeLocale = Array.isArray(locale) ? locale[0] : locale || 'en'

  // Refs
  const shadowRef = useRef<HTMLDivElement | null>(null)

  // Vars
  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

  const resolveScrollElement = (
    container: Parameters<ScrollMenuHandler>[0],
    useEventTarget: boolean
  ): HTMLElement | null => {
    if (!useEventTarget && container instanceof HTMLElement) {
      return container
    }

    if (useEventTarget && container && 'target' in (container as { target?: EventTarget | null })) {
      const target = (container as { target?: EventTarget | null }).target

      if (target instanceof HTMLElement) {
        return target
      }
    }

    return null
  }

  const scrollMenu: ScrollMenuHandler = (container, isPerfectScrollbar) => {
    const shadowElement = shadowRef.current
    if (!shadowElement) return

    const shouldUseEventTarget = isBreakpointReached || !isPerfectScrollbar
    const scrollElement = resolveScrollElement(container, shouldUseEventTarget)

    if (!scrollElement) return

    if (scrollElement.scrollTop > 0) {
      shadowElement.classList.add('scrolled')
    } else {
      shadowElement.classList.remove('scrolled')
    }
  }

  return (
    <>
      <NavHeader>
        <Link href={getLocalizedUrl('/', locale as Locale)}>
          <Logo />
        </Link>
        <NavCollapseIcons
          lockedIcon={<i className='ri-radio-button-line text-xl' />}
          unlockedIcon={<i className='ri-checkbox-blank-circle-line text-xl' />}
          closeIcon={<i className='ri-close-line text-xl' />}
          className='text-textSecondary'
        />
      </NavHeader>
      <StyledBoxForShadow ref={shadowRef} />
      <ScrollWrapper
        {...(isBreakpointReached
          ? {
              className: 'bs-full overflow-y-auto overflow-x-hidden',
              onScroll: container => scrollMenu(container, false)
            }
          : {
              options: { wheelPropagation: false, suppressScrollX: true },
              onScrollY: container => scrollMenu(container, true)
            })}
      >
        {mapHorizontalToVerticalMenu(children, safeLocale)}
      </ScrollWrapper>
    </>
  )
}

export default VerticalNavContent
