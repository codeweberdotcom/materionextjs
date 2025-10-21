// MUI Imports
import Grid from '@mui/material/Grid2'

// Component Imports
import LanguagesListTable from './LanguagesListTable'

const LanguagesList = () => {
  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <LanguagesListTable />
      </Grid>
    </Grid>
  )
}

export default LanguagesList