'use client'

// React Imports
import { useState } from 'react'
import type { SyntheticEvent, ReactElement } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid2'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabPanel from '@mui/lab/TabPanel'

// Component Imports
import CustomTabList from '@core/components/mui/TabList'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

const AccountSettings = ({ tabContentList }: { tabContentList: { [key: string]: ReactElement } }) => {
  // Hooks
  const dictionary = useTranslation()

  // States
  const [activeTab, setActiveTab] = useState('account')

  const handleChange = (event: SyntheticEvent, value: string) => {
    setActiveTab(value)
  }

  return (
    <TabContext value={activeTab}>
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <CustomTabList onChange={handleChange} variant='scrollable' pill='true'>
            <Tab label={dictionary.navigation.account} icon={<i className='ri-group-line' />} iconPosition='start' value='account' />
            <Tab label={dictionary.navigation.security} icon={<i className='ri-lock-unlock-line' />} iconPosition='start' value='security' />
            <Tab
              label={dictionary.navigation.billingPlans}
              icon={<i className='ri-bookmark-line' />}
              iconPosition='start'
              value='billing-plans'
            />
            <Tab
              label={dictionary.navigation.notifications}
              icon={<i className='ri-notification-3-line' />}
              iconPosition='start'
              value='notifications'
            />
            <Tab label={dictionary.navigation.connections} icon={<i className='ri-link' />} iconPosition='start' value='connections' />
          </CustomTabList>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <TabPanel value={activeTab} className='p-0'>
            {tabContentList[activeTab]}
          </TabPanel>
        </Grid>
      </Grid>
    </TabContext>
  )
}

export default AccountSettings
