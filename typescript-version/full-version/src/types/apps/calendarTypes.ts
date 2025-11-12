// Third-party Imports
import type { Dispatch } from '@reduxjs/toolkit'
import type { CalendarApi, EventApi, EventInput } from '@fullcalendar/core'

// Type Imports
import type { ThemeColor } from '@core/types'

export type CalendarFiltersType = 'Personal' | 'Business' | 'Family' | 'Holiday' | 'ETC'

export type CalendarColors = {
  ETC: ThemeColor
  Family: ThemeColor
  Holiday: ThemeColor
  Personal: ThemeColor
  Business: ThemeColor
}

export type CalendarSelectedEvent = (EventInput & { id?: string }) | EventApi | null

export type CalendarType = {
  events: EventInput[]
  filteredEvents: EventInput[]
  selectedEvent: CalendarSelectedEvent
  selectedCalendars: CalendarFiltersType[]
}

export type AddEventType = Omit<EventInput, 'id'>

export type SidebarLeftProps = {
  mdAbove: boolean
  calendarApi: CalendarApi | null
  calendarStore: CalendarType
  leftSidebarOpen: boolean
  dispatch: Dispatch
  calendarsColor: CalendarColors
  handleLeftSidebarToggle: () => void
  handleAddEventSidebarToggle: () => void
}

export type AddEventSidebarType = {
  calendarStore: CalendarType
  calendarApi: CalendarApi | null
  dispatch: Dispatch
  addEventSidebarOpen: boolean
  handleAddEventSidebarToggle: () => void
}
