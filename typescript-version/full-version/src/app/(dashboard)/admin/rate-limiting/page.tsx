'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Save, Trash2, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { toast } from 'react-toastify'

interface RateLimitConfig {
  module: string
  maxRequests: number
  windowMs: number
  blockMs: number
}

interface RateLimitStats {
  module: string
  config: RateLimitConfig
  totalRequests: number
  blockedCount: number
  activeWindows: number
}

export default function RateLimitingPage() {
  const [configs, setConfigs] = useState<RateLimitConfig[]>([])
  const [stats, setStats] = useState<RateLimitStats[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const response = await fetch('/api/admin/rate-limits')
      if (response.ok) {
        const data = await response.json()
        setConfigs(data.configs || [])
        setStats(data.stats || [])
      } else {
        toast.error('Failed to load rate limiting data')
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error loading data')
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = async (module: string, config: Partial<RateLimitConfig>) => {
    setSaving(module)
    try {
      const response = await fetch('/api/admin/rate-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, ...config })
      })

      if (response.ok) {
        toast.success('Configuration updated successfully')
        await loadData()
      } else {
        toast.error('Failed to update configuration')
      }
    } catch (error) {
      console.error('Error updating config:', error)
      toast.error('Error updating configuration')
    } finally {
      setSaving(null)
    }
  }

  const resetLimits = async (module?: string) => {
    try {
      const params = new URLSearchParams()
      if (module) params.set('module', module)

      const response = await fetch(`/api/admin/rate-limits?${params}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Rate limits reset successfully')
        await loadData()
      } else {
        toast.error('Failed to reset rate limits')
      }
    } catch (error) {
      console.error('Error resetting limits:', error)
      toast.error('Error resetting rate limits')
    }
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getModuleDisplayName = (module: string) => {
    const names = {
      chat: 'Чат',
      ads: 'Объявления',
      upload: 'Загрузки файлов',
      auth: 'Авторизация'
    }
    return names[module as keyof typeof names] || module
  }

  const getModuleDescription = (module: string) => {
    const descriptions = {
      chat: 'Ограничение количества сообщений в чате',
      ads: 'Ограничение количества публикаций объявлений',
      upload: 'Ограничение количества загружаемых файлов',
      auth: 'Ограничение попыток входа в систему'
    }
    return descriptions[module as keyof typeof descriptions] || ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rate Limiting</h1>
          <p className="text-muted-foreground">
            Настройка ограничений для различных модулей системы
          </p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Обновить
        </Button>
      </div>

      <Tabs defaultValue="configs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configs">Настройки</TabsTrigger>
          <TabsTrigger value="stats">Статистика</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {configs.map((config) => (
              <Card key={config.module}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {getModuleDisplayName(config.module)}
                    <Badge variant="secondary">{config.module}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {getModuleDescription(config.module)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`${config.module}-maxRequests`}>
                        Макс. запросов
                      </Label>
                      <Input
                        id={`${config.module}-maxRequests`}
                        type="number"
                        value={config.maxRequests}
                        onChange={(e) => {
                          const newConfigs = configs.map(c =>
                            c.module === config.module
                              ? { ...c, maxRequests: parseInt(e.target.value) || 0 }
                              : c
                          )
                          setConfigs(newConfigs)
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${config.module}-windowMs`}>
                        Окно времени
                      </Label>
                      <Input
                        id={`${config.module}-windowMs`}
                        type="number"
                        value={config.windowMs / 1000} // в секундах
                        onChange={(e) => {
                          const newConfigs = configs.map(c =>
                            c.module === config.module
                              ? { ...c, windowMs: (parseInt(e.target.value) || 0) * 1000 }
                              : c
                          )
                          setConfigs(newConfigs)
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(config.windowMs)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`${config.module}-blockMs`}>
                      Блокировка при превышении
                    </Label>
                    <Input
                      id={`${config.module}-blockMs`}
                      type="number"
                      value={config.blockMs / 1000} // в секундах
                      onChange={(e) => {
                        const newConfigs = configs.map(c =>
                          c.module === config.module
                            ? { ...c, blockMs: (parseInt(e.target.value) || 0) * 1000 }
                            : c
                        )
                        setConfigs(newConfigs)
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(config.blockMs)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => updateConfig(config.module, config)}
                      disabled={saving === config.module}
                      size="sm"
                    >
                      {saving === config.module ? (
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Сохранить
                    </Button>
                    <Button
                      onClick={() => resetLimits(config.module)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Сбросить счетчики
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {stats.map((stat) => (
              <Card key={stat.module}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {getModuleDisplayName(stat.module)}
                    <Badge variant="secondary">{stat.module}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Всего запросов</span>
                      </div>
                      <p className="text-2xl font-bold">{stat.totalRequests}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">Заблокировано</span>
                      </div>
                      <p className="text-2xl font-bold text-red-500">{stat.blockedCount}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Активных окон</span>
                    </div>
                    <p className="text-lg font-semibold">{stat.activeWindows}</p>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Лимит: {stat.config.maxRequests} запросов в {formatTime(stat.config.windowMs)}
                      <br />
                      Блокировка: {formatTime(stat.config.blockMs)}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Общие действия</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => resetLimits()}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Сбросить все счетчики
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}