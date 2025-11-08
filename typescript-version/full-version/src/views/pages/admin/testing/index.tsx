'use client'

// React Imports
import { useEffect, useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

interface TestResult {
  title: string
  status: 'passed' | 'failed'
  duration: number
  file: string
  timestamp: string
  type: string
}

const TestingPage = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningTests, setRunningTests] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<TestResult | null>(null)

  const fetchTestResults = async () => {
    try {
      // Используем API endpoint для чтения результатов тестов
      const response = await fetch('/api/admin/test-results')
      if (!response.ok) {
        throw new Error('Failed to load test results')
      }
      const data = await response.json()

      // Парсим результаты из JSON структуры Playwright
      const results: TestResult[] = []

      data.suites?.forEach((suite: any) => {
        suite.specs?.forEach((spec: any) => {
          spec.tests?.forEach((test: any) => {
            const result = test.results?.[0]
            if (result) {
              results.push({
                title: test.title || spec.title,
                status: result.status === 'passed' ? 'passed' : 'failed',
                duration: result.duration || 0,
                file: suite.file || spec.file,
                timestamp: result.startTime ? new Date(result.startTime).toISOString() : new Date().toISOString(),
                type: (suite.file || spec.file).endsWith('.spec.ts') || (suite.file || spec.file).endsWith('.test.ts') ? 'E2E' :
                      (suite.file || spec.file).includes('unit') ? 'Unit' :
                      (suite.file || spec.file).includes('integration') ? 'Integration' : 'Unknown'
              })
            }
          })
        })
      })

      setTestResults(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test results')
    } finally {
      setLoading(false)
    }
  }

  // Calculate test statistics
  const getTestStats = () => {
    const total = testResults.length
    const passed = testResults.filter(t => t.status === 'passed').length
    const failed = testResults.filter(t => t.status === 'failed').length
    return `${total}/${passed}/${failed}`
  }

  useEffect(() => {
    fetchTestResults()
  }, [])

  const runTests = async () => {
    setRunningTests(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/run-tests', {
        method: 'POST',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Test execution failed')
      }

      // Refresh test results after running
      await fetchTestResults()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run tests')
    } finally {
      setRunningTests(false)
    }
  }

  const openTestDetails = (test: TestResult) => {
    setSelectedTest(test)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedTest(null)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader title="Testing Dashboard" />
        <div className="p-5">
          <Typography>Loading test results...</Typography>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="Testing Dashboard" />
        <div className="p-5">
          <Typography color="error">Error: {error}</Typography>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader title="Testing Dashboard" />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <Button
            color='secondary'
            variant='outlined'
            startIcon={<i className='ri-upload-2-line text-xl' />}
            className='max-sm:is-full'
          >
            Export Results
          </Button>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <Button
              onClick={runTests}
              disabled={runningTests}
              variant='contained'
              className='max-sm:is-full'
              startIcon={runningTests ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <i className='ri-play-line text-xl' />}
            >
              {runningTests ? 'Running Tests...' : 'Run Tests'}
            </Button>
          </div>
        </div>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Test</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Date/Time</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Total/Passed/Failed</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {testResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary">No test results found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                testResults.map((test, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Chip
                        variant='tonal'
                        label={test.status === 'passed' ? 'Passed' : 'Failed'}
                        size='small'
                        color={test.status === 'passed' ? 'success' : 'error'}
                        className='capitalize'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography className='font-medium' color='text.primary'>
                        {test.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        variant='tonal'
                        label={test.type}
                        size='small'
                        color='primary'
                        className='capitalize'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {(test.duration / 1000).toFixed(1)}s
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {new Date(test.timestamp).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {test.file}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.primary' className='font-medium'>
                        {getTestStats()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton onClick={() => openTestDetails(test)}>
                        <i className='ri-eye-line text-textSecondary' />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

      </Card>

      {/* Right Drawer for Test Details */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-xl overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '60rem',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease'
        }}
      >
        {selectedTest && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Test Details: {selectedTest.title}
              </h2>
              <button
                onClick={closeDrawer}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src="/api/admin/html-report"
                className="w-full h-full border-0"
                title="Test Report"
              />
            </div>
          </>
        )}
      </div>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={closeDrawer}
        />
      )}
    </>
  )
}

export default TestingPage