'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

// Third-party Imports
import Skeleton from '@mui/material/Skeleton'

// Data Imports
import { playwrightTestScripts } from '@/data/testing/test-scripts'
import tableStyles from '@core/styles/table.module.css'
import { useTranslation } from '@/contexts/TranslationContext'

type ScriptRunSummary = {
  runId: string
  scriptId: string
  title: string
  file: string
  status: 'passed' | 'failed'
  duration: number
  startedAt: string
  finishedAt: string
}

type PlaywrightRun = {
  runId: string
  label: string
  testId: string
  status: 'passed' | 'failed'
  startedAt: string
  finishedAt: string
  scripts: ScriptRunSummary[]
}

const TestingPage = () => {
  const translation = useTranslation()
  const t = translation?.testing ?? ({} as Record<string, string>)
  const params = useParams()
  const locale = typeof params?.lang === 'string' ? params.lang : Array.isArray(params?.lang) ? params.lang[0] : 'en'
  const [runs, setRuns] = useState<PlaywrightRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningTests, setRunningTests] = useState(false)
  const [runningTestId, setRunningTestId] = useState<string | null>(null)
  const [runningMode, setRunningMode] = useState<'headed' | 'headless' | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedRunTitle, setSelectedRunTitle] = useState<string>('')

  const latestByScript = useMemo<Map<string, ScriptRunSummary & { runId: string }>>(() => {
    const map = new Map<string, ScriptRunSummary & { runId: string }>()
    runs.forEach(run => {
      run.scripts?.forEach(script => {
        const key = script.scriptId || script.file
        if (!key) return
        if (!map.has(key)) {
          map.set(key, { ...script, runId: run.runId })
        }
      })
    })
    return map
  }, [runs])

  const recentEntries = useMemo<(ScriptRunSummary & { runId: string; runLabel: string })[]>(() => {
    const entries = runs.flatMap(run =>
      (run.scripts || []).map(script => ({
        ...script,
        runId: run.runId,
        runLabel: run.label,
        startedAt: script.startedAt || run.startedAt
      }))
    )

    entries.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )

    return entries
  }, [runs])

  const scriptStats = useMemo(() => {
    const map = new Map<string, { total: number; passed: number; failed: number }>()

    runs.forEach(run => {
      run.scripts?.forEach(script => {
        const key = script.scriptId || script.file || script.title
        if (!key) return
        const entry = map.get(key) || { total: 0, passed: 0, failed: 0 }
        entry.total += 1
        if (script.status === 'passed') {
          entry.passed += 1
        } else {
          entry.failed += 1
        }
        map.set(key, entry)
      })
    })

    return map
  }, [runs])


  const fetchRuns = async () => {
    setError(null)
    try {
      const response = await fetch('/api/admin/test-runs?limit=50')
      if (!response.ok) {
        throw new Error(t.errorLoad || 'Failed to load test runs')
      }
      const data = await response.json()
      setRuns(Array.isArray(data.runs) ? data.runs : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : (t.errorLoad || 'Failed to load test runs'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuns()
  }, [])

  const runTests = async (testId: string = 'all', mode: 'headed' | 'headless' = 'headed') => {
    const runSingleTest = async (id: string) => {
      const response = await fetch('/api/admin/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: id, mode })
      })

      const result = await response.json()

      if (!response.ok || result.success === false) {
        throw new Error(result.error || (t.errorRun || 'Test execution failed'))
      }
    }

    setRunningTests(true)
    setRunningMode(mode)
    setError(null)

    try {
      if (testId === 'all') {
        for (const script of playwrightTestScripts) {
          setRunningTestId(script.id)
          await runSingleTest(script.id)
        }
      } else {
        setRunningTestId(testId)
        await runSingleTest(testId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (t.errorRun || 'Failed to run tests'))
    } finally {
      setRunningTests(false)
      setRunningTestId(null)
      setRunningMode(null)
      await fetchRuns()
    }
  }

  const openTestDetails = (scriptRun: ScriptRunSummary & { runId: string }) => {
    setSelectedRunId(scriptRun.runId)
    setSelectedRunTitle(`${scriptRun.title} (${new Date(scriptRun.startedAt).toLocaleString()})`)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedRunId(null)
    setSelectedRunTitle('')
  }

  if (loading) {
    const skeletonRows = playwrightTestScripts.length || 3

    return (
      <Card>
        <CardHeader>
          <Skeleton width={200} height={28} />
        </CardHeader>
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <Skeleton width={220} height={40} />
          </div>
          <Skeleton width={150} height={36} />
        </div>
        <TableContainer className='overflow-x-auto'>
          <Table className={tableStyles.table}>
            <TableHead>
              <TableRow>
                {Array.from({ length: 8 }).map((_, index) => (
                  <TableCell key={index}>
                    <Skeleton width={100} height={20} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: skeletonRows }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: 8 }).map((__, cellIdx) => (
                    <TableCell key={cellIdx}>
                      <Skeleton width={cellIdx === 7 ? 120 : 100} height={16} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div className='border-bs p-4'>
          <Skeleton width={200} height={24} />
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader title={t.title || 'Testing'} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <Button
            color='secondary'
            variant='outlined'
            startIcon={<i className='ri-upload-2-line text-xl' />}
            className='max-sm:is-full'
          >
            {t.exportResults || 'Export Results'}
          </Button>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <Button
              onClick={() => runTests('all', 'headed')}
              disabled={runningTests}
              variant='contained'
              className='max-sm:is-full'
              startIcon={
                runningTests ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <i className='ri-play-line text-xl' />
                )
              }
            >
              {runningTests ? (t.running || 'Running Tests...') : (t.runTests || 'Run Tests')}
            </Button>
          </div>
        </div>
        <TableContainer className='overflow-x-auto'>
          <Table className={tableStyles.table}>
            <TableHead>
              <TableRow>
                <TableCell>{t.tableHeaderStatus || 'Status'}</TableCell>
                <TableCell>{t.tableHeaderScript || 'Test'}</TableCell>
                <TableCell>{t.tableHeaderType || 'Type'}</TableCell>
                <TableCell>{t.tableHeaderFile || 'File'}</TableCell>
                <TableCell>{t.tableHeaderTotals || 'Total/Passed/Failed'}</TableCell>
                <TableCell>{t.tableHeaderActions || 'Actions'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {playwrightTestScripts.map(script => {
                const scriptKey = script.id || script.file
                const scriptResult = scriptKey ? latestByScript.get(scriptKey) : undefined
                const statsKey = scriptKey || script.file || script.title
                const stats = statsKey ? scriptStats.get(statsKey) : undefined
                const chipLabel = scriptResult
                  ? (scriptResult.status === 'passed' ? (t.statusPassed || 'Passed') : (t.statusFailed || 'Failed'))
                  : (t.statusNotRun || 'Not run')
                const chipColor: 'default' | 'success' | 'error' =
                  scriptResult ? (scriptResult.status === 'passed' ? 'success' : 'error') : 'default'
                return (
                  <TableRow key={script.id}>
                    <TableCell>
                      <Chip
                        variant='tonal'
                        label={chipLabel}
                        size='small'
                        color={chipColor}
                        className='capitalize'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography className='font-medium' color='text.primary'>
                        {script.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        variant='tonal'
                        label={script.type}
                        size='small'
                        color='primary'
                        className='capitalize'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {script.file}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2 text-sm font-medium'>
                        <Chip
                          size='small'
                          variant='tonal'
                          color='default'
                          label={stats?.total ?? 0}
                          className='!text-xs'
                        />
                        <Chip
                          size='small'
                          variant='tonal'
                          color='success'
                          label={stats?.passed ?? 0}
                          className='!text-xs'
                        />
                        <Chip
                          size='small'
                          variant='tonal'
                          color='error'
                          label={stats?.failed ?? 0}
                          className='!text-xs'
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1'>
                        <Tooltip title={script.description} arrow>
                          <IconButton aria-label='Test info' size='small'>
                            <i className='ri-information-line text-textSecondary' />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t.runHeaded || 'Run with UI'} arrow>
                          <IconButton
                            aria-label='Run headed'
                            onClick={() => runTests(script.id, 'headed')}
                            disabled={runningTests}
                            size='small'
                          >
                            {runningTests && runningTestId === script.id && runningMode === 'headed' ? (
                              <div className="w-4 h-4 border-2 border-[var(--mui-palette-success-main)] border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <i className='ri-play-line text-[var(--mui-palette-success-main)]' />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t.runHeadless || 'Run headless'} arrow>
                          <IconButton
                            aria-label='Run headless'
                            onClick={() => runTests(script.id, 'headless')}
                            disabled={runningTests}
                            size='small'
                          >
                            {runningTests && runningTestId === script.id && runningMode === 'headless' ? (
                              <div className="w-4 h-4 border-2 border-[var(--mui-palette-info-main)] border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <i className='ri-play-line text-[var(--mui-palette-info-main)]' />
                            )}
                          </IconButton>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

      </Card>

      <Card className='mt-6'>
        <CardHeader title={t.recentRunsTitle || 'Recent Runs'} />
        <Divider />
        <TableContainer className='overflow-x-auto'>
          <Table className={tableStyles.table}>
            <TableHead>
              <TableRow>
                <TableCell>{t.columnRun || 'Run'}</TableCell>
                <TableCell>{t.columnTest || 'Test'}</TableCell>
                <TableCell>{t.tableHeaderStatus || 'Status'}</TableCell>
                <TableCell>{t.tableHeaderDuration || 'Duration'}</TableCell>
                <TableCell>{t.columnDateTime || 'Date/Time'}</TableCell>
                <TableCell>{t.tableHeaderActions || 'Actions'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center'>
                    {t.noRuns || 'No test runs yet'}
                  </TableCell>
                </TableRow>
              ) : (
                recentEntries.slice(0, 10).map(entry => (
                  <TableRow key={`${entry.runId}-${entry.file}-${entry.startedAt}`}>
                    <TableCell>
                      <Typography className='font-medium'>{entry.runLabel}</Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {entry.runId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography>{entry.title}</Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {entry.file}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.status === 'passed' ? (t.statusPassed || 'Passed') : (t.statusFailed || 'Failed')}
                        color={entry.status === 'passed' ? 'success' : 'error'}
                        variant='tonal'
                        size='small'
                        className='capitalize'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {(entry.duration / 1000).toFixed(1)}s
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {new Date(entry.startedAt).toLocaleString(locale)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={t.viewReport || 'View report'} arrow>
                        <IconButton
                          aria-label={t.viewReport || 'View report'}
                          size='small'
                          onClick={() => openTestDetails(entry)}
                        >
                          <i className='ri-eye-line text-textSecondary' />
                        </IconButton>
                      </Tooltip>
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
        className="fixed inset-y-0 right-0 z-[1200] flex flex-col bg-white shadow-xl overflow-hidden"
        style={{
          width: '100%',
          maxWidth: '60rem',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease'
        }}
      >
        {selectedRunId && (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Test Details: {selectedRunTitle || selectedRunId}
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
                src={`/api/admin/html-report${selectedRunId ? `?runId=${selectedRunId}` : ''}`}
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
          className="fixed inset-0 bg-black bg-opacity-50 z-[1100] transition-opacity duration-300"
          onClick={closeDrawer}
        />
      )}
    </>
  )
}

export default TestingPage
