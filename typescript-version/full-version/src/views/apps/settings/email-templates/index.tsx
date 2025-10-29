'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  createdAt: string
  updatedAt: string
}

const EmailTemplates = () => {
  // States
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: ''
  })

  const [message, setMessage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  // Hooks
  const dictionary = useTranslation()

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/settings/email-templates')

      if (response.ok) {
        const data = await response.json()

        setTemplates(data)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setFormData({ name: '', subject: '', content: '' })
    setDialogOpen(true)
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      subject: template.subject,
      content: template.content
    })
    setDialogOpen(true)
  }

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить шаблон "${name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/settings/email-templates/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id))
        setMessage('Шаблон удален успешно!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage('Ошибка при удалении шаблона.')
      }
    } catch (error) {
      setMessage('Ошибка при удалении шаблона.')
    }
  }

  const handlePreviewTemplate = (template: EmailTemplate) => {
    setPreviewTemplate(template)
    setPreviewOpen(true)
  }

  const handleClosePreview = () => {
    setPreviewOpen(false)
    setPreviewTemplate(null)
  }

  // Sample variables for preview
  const sampleVariables = {
    name: 'Иван Иванов',
    email: 'ivan@example.com',
    date: new Date().toLocaleDateString('ru-RU'),
    link: 'https://example.com/reset-password'
  }

  // Replace variables in template
  const replaceVariables = (text: string, variables: Record<string, string>): string => {
    let result = text

    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value)
    })
    
return result
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingTemplate
        ? `/api/settings/email-templates/${editingTemplate.id}`
        : '/api/settings/email-templates'

      const method = editingTemplate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const updatedTemplate = await response.json()

        if (editingTemplate) {
          setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updatedTemplate : t))
          setMessage('Шаблон обновлен успешно!')
        } else {
          setTemplates(prev => [...prev, updatedTemplate])
          setMessage('Шаблон создан успешно!')
        }

        setDialogOpen(false)
        setTimeout(() => setMessage(''), 3000)
      } else {
        const error = await response.json()

        setMessage(error.message || 'Ошибка при сохранении шаблона.')
      }
    } catch (error) {
      setMessage('Ошибка при сохранении шаблона.')
    }
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingTemplate(null)
    setFormData({ name: '', subject: '', content: '' })
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography>Загрузка шаблонов...</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title={dictionary?.navigation?.emailTemplates || 'Email Templates'}
          action={
            <Button variant='contained' onClick={handleCreateTemplate}>
              {dictionary?.navigation?.createTemplate || 'Create Template'}
            </Button>
          }
        />
        <CardContent>
          {message && (
            <Alert severity={message.includes('успешно') ? 'success' : 'error'} sx={{ mb: 4 }}>
              {message}
            </Alert>
          )}

          {templates.length === 0 ? (
            <Typography>Нет созданных шаблонов</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{dictionary?.navigation?.templateName || 'Template Name'}</TableCell>
                    <TableCell>{dictionary?.navigation?.templateSubject || 'Subject'}</TableCell>
                    <TableCell>{dictionary?.navigation?.templateContent || 'Content'}</TableCell>
                    <TableCell>{dictionary?.navigation?.templateVariables || 'Variables'}</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell>{template.name}</TableCell>
                      <TableCell>{template.subject}</TableCell>
                      <TableCell>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: template.content.length > 100
                              ? template.content.substring(0, 100) + '...'
                              : template.content
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {['{name}', '{email}', '{date}', '{link}'].map(variable => (
                            <Chip
                              key={variable}
                              label={variable}
                              size='small'
                              variant='outlined'
                              color='primary'
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={() => handlePreviewTemplate(template)} title={dictionary?.navigation?.previewTemplate || 'Preview'}>
                          <i className='ri-eye-line' />
                        </IconButton>
                        <IconButton onClick={() => handleEditTemplate(template)} title={dictionary?.navigation?.editTemplate || 'Edit'}>
                          <i className='ri-edit-line' />
                        </IconButton>
                        <IconButton onClick={() => handleDeleteTemplate(template.id, template.name)} title={dictionary?.navigation?.deleteTemplate || 'Delete'}>
                          <i className='ri-delete-bin-7-line' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Template Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth='md' fullWidth>
        <DialogTitle>
          {editingTemplate ? dictionary?.navigation?.editTemplate || 'Edit Template' : dictionary?.navigation?.createTemplate || 'Create Template'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.templateName || 'Template Name'}
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.templateSubject || 'Email Subject'}
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={dictionary?.navigation?.templateContent || 'Email Content (HTML)'}
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  multiline
                  rows={8}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant='body2' color='text.secondary'>
                  {dictionary?.navigation?.templateVariables || 'Available variables'}: {'{name}'}, {'{email}'}, {'{date}'}, {'{link}'}
                </Typography>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>
              {dictionary?.navigation?.cancel || 'Cancel'}
            </Button>
            <Button type='submit' variant='contained'>
              {editingTemplate ? dictionary?.navigation?.saveChanges || 'Save Changes' : dictionary?.navigation?.create || 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={handleClosePreview} maxWidth='md' fullWidth>
        <DialogTitle>
          {dictionary?.navigation?.previewTemplate || 'Preview Template'}: {previewTemplate?.name}
        </DialogTitle>
        <DialogContent>
          {previewTemplate && (
            <Box>
              <Typography variant='subtitle2' gutterBottom>
                <strong>{dictionary?.navigation?.templateSubject || 'Subject'}:</strong>
              </Typography>
              <Typography variant='body1' sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                {replaceVariables(previewTemplate.subject, sampleVariables)}
              </Typography>

              <Typography variant='subtitle2' gutterBottom>
                <strong>{dictionary?.navigation?.templateContent || 'Content'}:</strong>
              </Typography>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}
                dangerouslySetInnerHTML={{
                  __html: replaceVariables(previewTemplate.content, sampleVariables)
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>
            {dictionary?.navigation?.cancel || 'Close'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default EmailTemplates