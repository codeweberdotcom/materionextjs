// Type Imports
import type { ChildrenType, Direction } from '@core/types'

// Context Imports
import { NextAuthProvider } from '@/contexts/nextAuthProvider'
import { VerticalNavProvider } from '@menu/contexts/verticalNavContext'
import { SettingsProvider } from '@core/contexts/settingsContext'
import ThemeProvider from '@components/theme'
import ReduxProvider from '@/redux-store/ReduxProvider'
import { SocketProvider } from '@/contexts/SocketProvider'
import NotificationsInitializer from '@/components/NotificationsInitializer'

// Styled Component Imports
import AppReactToastify from '@/libs/styles/AppReactToastify'

// Util Imports
import { getMode, getSettingsFromCookie, getSystemMode } from '@core/utils/serverHelpers'

type Props = ChildrenType & {
  direction: Direction
}

const Providers = async (props: Props) => {
  // Props
  const { children, direction } = props

  // Vars
  const mode = await getMode()
  const settingsCookie = await getSettingsFromCookie()
  const systemMode = await getSystemMode()

  return (
    <NextAuthProvider>
      <SocketProvider>
        <ReduxProvider>
          <NotificationsInitializer />
          <VerticalNavProvider>
            <SettingsProvider settingsCookie={settingsCookie} mode={mode}>
              <ThemeProvider direction={direction} systemMode={systemMode}>
                {children}
                <AppReactToastify direction={direction} hideProgressBar />
              </ThemeProvider>
            </SettingsProvider>
          </VerticalNavProvider>
        </ReduxProvider>
      </SocketProvider>
    </NextAuthProvider>
  )
}

export default Providers
