// MUI Imports
import type { Theme } from '@mui/material/styles'

const skeleton: Theme['components'] = {
  MuiSkeleton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.shape.borderRadius
      }),
      rectangular: ({ theme }) => ({
        borderRadius: theme.shape.borderRadius,
        '&:not(:last-of-type)': {
          marginBottom: theme.spacing(1.5)
        }
      })
    }
  }
}

export default skeleton
