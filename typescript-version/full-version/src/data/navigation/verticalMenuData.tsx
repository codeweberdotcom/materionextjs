// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'
import type { getDictionary } from '@/utils/formatting/getDictionary'

const verticalMenuData = (dictionary: Awaited<ReturnType<typeof getDictionary>>): VerticalMenuDataType[] => [
  // This is how you will normally render submenu
  {
    label: dictionary['navigation'].dashboards,
    icon: 'ri-home-smile-line',
    suffix: {
      label: '5',
      color: 'error'
    },
    children: [
      // This is how you will normally render menu item
      {
        label: dictionary['navigation'].crm,
        href: '/dashboards/crm'
      },
      {
        label: dictionary['navigation'].analytics,
        href: '/dashboards/analytics'
      },
      {
        label: dictionary['navigation'].eCommerce,
        href: '/dashboards/ecommerce'
      },
      {
        label: dictionary['navigation'].academy,
        href: '/dashboards/academy'
      },
      {
        label: dictionary['navigation'].logistics,
        href: '/dashboards/logistics'
      }
    ]
  },
  {
    label: dictionary['navigation'].frontPages,
    icon: 'ri-file-copy-line',
    children: [
      {
        label: dictionary['navigation'].landing,
        href: '/front-pages/landing-page',
        target: '_blank',
        excludeLang: true
      },
      {
        label: dictionary['navigation'].pricing,
        href: '/front-pages/pricing',
        target: '_blank',
        excludeLang: true
      },
      {
        label: dictionary['navigation'].payment,
        href: '/front-pages/payment',
        target: '_blank',
        excludeLang: true
      },
      {
        label: dictionary['navigation'].checkout,
        href: '/front-pages/checkout',
        target: '_blank',
        excludeLang: true
      },
      {
        label: dictionary['navigation'].helpCenter,
        href: '/front-pages/help-center',
        target: '_blank',
        excludeLang: true
      }
    ]
  },

  // This is how you will normally render menu section
  {
    label: dictionary['navigation'].communications,
    icon: 'ri-customer-service-2-line',
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].chat,
        icon: 'ri-wechat-line',
        href: '/apps/chat'
      },
      {
        label: dictionary['navigation'].notifications,
        icon: 'ri-notification-2-line',
        href: '/apps/notifications'
      }
    ]
  },
  // Accounts Section
  {
    label: dictionary['navigation'].accounts || 'Аккаунты',
    icon: 'ri-user-settings-line',
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].myAccounts || 'Мои аккаунты',
        icon: 'ri-account-box-line',
        href: '/accounts'
      },
      {
        label: dictionary['navigation'].tariffPlans || 'Тарифные планы',
        icon: 'ri-vip-crown-line',
        href: '/accounts/tariffs'
      },
      {
        label: dictionary['navigation'].accountManagers || 'Менеджеры',
        icon: 'ri-user-add-line',
        href: '/accounts/managers'
      },
      {
        label: dictionary['navigation'].accountTransfers || 'Передача аккаунтов',
        icon: 'ri-share-forward-line',
        href: '/accounts/transfers'
      },
      {
        label: dictionary['navigation'].createAccount || 'Создать аккаунт',
        icon: 'ri-add-circle-line',
        href: '/accounts/create'
      }
    ]
  },
  {
    label: dictionary['navigation'].adminAndSettings,
    icon: 'ri-settings-5-line',
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].userSettings,
        icon: 'ri-user-settings-line',
        children: [
          {
            label: dictionary['navigation'].userList,
            href: '/apps/user/list'
          },
          {
            label: dictionary['navigation'].view,
            href: '/apps/user/view'
          },
          {
            label: dictionary['navigation'].documentsVerification || 'Подтверждение документов',
            href: '/apps/user/documents-verification'
          },
          {
            label: dictionary['navigation'].roles,
            href: '/apps/roles'
          },
          {
            label: dictionary['navigation'].permissions,
            href: '/apps/permissions'
          }
        ]
      },
      {
        label: dictionary['navigation'].references,
        icon: 'ri-database-2-line',
        children: [
          {
            label: dictionary['navigation'].languages,
            icon: 'ri-translate-2',
            href: '/apps/references/languages'
          },
          {
            label: dictionary['navigation'].countriesAndStates,
            icon: 'ri-flag-line',
            children: [
              {
                label: dictionary['navigation'].countries,
                href: '/apps/references/countries'
              },
              {
                label: dictionary['navigation'].states,
                icon: 'ri-map-pin-2-line',
                href: '/apps/references/states'
              },
              {
                label: dictionary['navigation'].cities,
                icon: 'ri-map-pin-4-line',
                href: '/apps/references/cities'
              },
              {
                label: dictionary['navigation'].districts,
                icon: 'ri-map-pin-5-line',
                href: '/apps/references/districts'
              }
            ]
          },
          {
            label: dictionary['navigation'].currencies,
            icon: 'ri-money-dollar-circle-line',
            href: '/apps/references/currencies'
          },
          {
            label: dictionary['navigation'].translations,
            icon: 'ri-global-line',
            href: '/apps/references/translations'
          }
        ]
      },
      {
        label: dictionary['navigation'].smtpSettings,
        icon: 'ri-mail-settings-line',
        href: '/apps/settings/smtp'
      },
      {
        label: dictionary['navigation'].emailTemplates,
        icon: 'ri-file-text-line',
        href: '/apps/settings/email-templates'
      },
      {
        label: dictionary['navigation'].registrationSettings || 'Настройки регистрации',
        icon: 'ri-user-add-line',
        href: '/apps/settings/registration'
      },
      {
        label: dictionary['navigation'].slugSettings || 'Username Settings',
        icon: 'ri-at-line',
        href: '/admin/settings/slug'
      },
      {
        label: dictionary['navigation'].smsRuSettings,
        icon: 'ri-message-3-line',
        href: '/apps/settings/sms-ru'
      },
      {
        label: dictionary['navigation'].telegramSettings,
        icon: 'ri-telegram-line',
        href: '/apps/settings/telegram'
      },
      {
        label: dictionary['navigation'].notificationScenarios,
        icon: 'ri-flow-chart',
        href: '/admin/notifications/scenarios'
      },
      {
        label: dictionary['navigation'].externalServices || 'External Services',
        icon: 'ri-server-line',
        href: '/admin/settings/services'
      },
      {
        label: dictionary['navigation'].webScraper || 'Web Scraper',
        icon: 'ri-fire-line',
        href: '/admin/tools/web-scraper'
      }
    ]
  },  // Media Section
  {
    label: dictionary['navigation'].media || 'Медиа',
    icon: 'ri-image-line',
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].mediaLibrary || 'Медиатека',
        icon: 'ri-gallery-line',
        href: '/admin/media'
      },
      {
        label: dictionary['navigation'].mediaSettings || 'Настройки',
        icon: 'ri-settings-3-line',
        href: '/admin/media/settings'
      },
      {
        label: dictionary['navigation'].mediaSync || 'Синхронизация',
        icon: 'ri-refresh-line',
        href: '/admin/media/sync'
      },
      {
        label: dictionary['navigation'].mediaWatermarks || 'Водяные знаки',
        icon: 'ri-drop-line',
        href: '/admin/media/watermarks'
      },
      {
        label: dictionary['navigation'].mediaLicenses || 'Лицензии',
        icon: 'ri-file-shield-2-line',
        href: '/admin/media/licenses'
      }
    ]
  },
  {
    label: dictionary['navigation'].monitoring,
    icon: 'ri-bar-chart-line',
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].monitoringDashboard || 'Dashboard',
        icon: 'ri-dashboard-line',
        href: '/admin/monitoring/dashboard'
      },
      {
        label: dictionary['navigation'].monitoringMetrics,
        icon: 'ri-bar-chart-2-line',
        href: '/admin/monitoring/metrics'
      },
      {
        label: dictionary['navigation'].monitoringErrorTracking,
        icon: 'ri-error-warning-line',
        href: '/admin/monitoring/error-tracking'
      },
      {
        label: dictionary['navigation'].monitoringApplicationInsights,
        icon: 'ri-lightbulb-line',
        href: '/admin/monitoring/application-insights'
      },
      {
        label: dictionary['navigation'].monitoringTesting || dictionary['navigation'].testingConnection || 'Testing',
        icon: 'ri-test-tube-line',
        href: '/admin/monitoring/testing'
      },
      {
        label: dictionary['navigation'].maintenance || 'Maintenance',
        icon: 'ri-tools-line',
        href: '/admin/maintenance'
      }
    ]
  },  {
    label: dictionary['navigation'].blocking,
    icon: 'ri-shield-check-line',
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].rateLimitManagement,
        icon: 'ri-timer-flash-line',
        href: '/admin/rate-limits'
      },
      {
        label: dictionary['navigation'].rateLimitEvents,
        icon: 'ri-line-chart-line',
        href: '/admin/rate-limits/events'
      },
      {
        label: dictionary['navigation'].blocking,
        icon: 'ri-shield-check-line',
        href: '/admin/blocks'
      },
      {
        label: dictionary['navigation'].eventsJournal,
        icon: 'ri-history-line',
        href: '/admin/events'
      }
    ]
  },
      {
        label: dictionary['navigation'].pages,
        icon: 'ri-layout-left-line',
        children: [
          {
            label: dictionary['navigation'].userProfile,
            href: '/pages/user-profile'
          },
          {
            label: dictionary['navigation'].accountSettings,
            href: '/pages/account-settings'
          },
          {
            label: dictionary['navigation'].faq,
            href: '/pages/faq'
          },
          {
            label: dictionary['navigation'].pricing,
            href: '/pages/pricing'
          },
          {
            label: dictionary['navigation'].miscellaneous,
            children: [
              {
                label: dictionary['navigation'].comingSoon,
                href: '/pages/misc/coming-soon',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].underMaintenance,
                href: '/pages/misc/under-maintenance',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].pageNotFound404,
                href: '/pages/misc/404-not-found',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].notAuthorized401,
                href: '/pages/misc/401-not-authorized',
                target: '_blank'
              }
            ]
          }
        ]
      },
      {
        label: dictionary['navigation'].authPages,
        icon: 'ri-shield-keyhole-line',
        children: [
          {
            label: dictionary['navigation'].login,
            children: [
              {
                label: dictionary['navigation'].loginV1,
                href: '/pages/auth/login-v1',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].loginV2,
                href: '/pages/auth/login-v2',
                target: '_blank'
              }
            ]
          },
          {
            label: dictionary['navigation'].register,
            children: [
              {
                label: dictionary['navigation'].registerV1,
                href: '/pages/auth/register-v1',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].registerV2,
                href: '/pages/auth/register-v2',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].registerMultiSteps,
                href: '/pages/auth/register-multi-steps',
                target: '_blank'
              }
            ]
          },
          {
            label: dictionary['navigation'].verifyEmail,
            children: [
              {
                label: dictionary['navigation'].verifyEmailV1,
                href: '/pages/auth/verify-email-v1',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].verifyEmailV2,
                href: '/pages/auth/verify-email-v2',
                target: '_blank'
              }
            ]
          },
          {
            label: dictionary['navigation'].forgotPassword,
            children: [
              {
                label: dictionary['navigation'].forgotPasswordV1,
                href: '/pages/auth/forgot-password-v1',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].forgotPasswordV2,
                href: '/pages/auth/forgot-password-v2',
                target: '_blank'
              }
            ]
          },
          {
            label: dictionary['navigation'].resetPassword,
            children: [
              {
                label: dictionary['navigation'].resetPasswordV1,
                href: '/pages/auth/reset-password-v1',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].resetPasswordV2,
                href: '/pages/auth/reset-password-v2',
                target: '_blank'
              }
            ]
          },
          {
            label: dictionary['navigation'].twoSteps,
            children: [
              {
                label: dictionary['navigation'].twoStepsV1,
                href: '/pages/auth/two-steps-v1',
                target: '_blank'
              },
              {
                label: dictionary['navigation'].twoStepsV2,
                href: '/pages/auth/two-steps-v2',
                target: '_blank'
              }
            ]
          }
        ]
      },
      {
        label: dictionary['navigation'].wizardExamples,
        icon: 'ri-git-commit-line',
        children: [
          {
            label: dictionary['navigation'].checkout,
            href: '/pages/wizard-examples/checkout'
          },
          {
            label: dictionary['navigation'].propertyListing,
            href: '/pages/wizard-examples/property-listing'
          },
          {
            label: dictionary['navigation'].createDeal,
            href: '/pages/wizard-examples/create-deal'
          }
        ]
      },
      {
        label: dictionary['navigation'].dialogExamples,
        icon: 'ri-tv-2-line',
        href: '/pages/dialog-examples'
      },
      {
        label: dictionary['navigation'].widgetExamples,
        icon: 'ri-bar-chart-box-line',
        children: [
          {
            label: dictionary['navigation'].basic,
            href: '/pages/widget-examples/basic'
          },
          {
            label: dictionary['navigation'].advanced,
            href: '/pages/widget-examples/advanced'
          },
          {
            label: dictionary['navigation'].statistics,
            href: '/pages/widget-examples/statistics'
          },
          {
            label: dictionary['navigation'].charts,
            href: '/pages/widget-examples/charts'
          },
          {
            label: dictionary['navigation'].gamification,
            href: '/pages/widget-examples/gamification'
          },
          {
            label: dictionary['navigation'].actions,
            href: '/pages/widget-examples/actions'
          }
        ]
      },
  {
    label: dictionary['navigation'].appsPages,
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].eCommerce,
        icon: 'ri-shopping-bag-3-line',
        children: [
          {
            label: dictionary['navigation'].dashboard,
            href: '/apps/ecommerce/dashboard'
          },
          {
            label: dictionary['navigation'].products,
            children: [
              {
                label: dictionary['navigation'].list,
                href: '/apps/ecommerce/products/list'
              },
              {
                label: dictionary['navigation'].add,
                href: '/apps/ecommerce/products/add'
              },
              {
                label: dictionary['navigation'].category,
                href: '/apps/ecommerce/products/category'
              }
            ]
          },
          {
            label: dictionary['navigation'].orders,
            children: [
              {
                label: dictionary['navigation'].list,
                href: '/apps/ecommerce/orders/list'
              },
              {
                label: dictionary['navigation'].details,
                href: '/apps/ecommerce/orders/details/5434',
                exactMatch: false,
                activeUrl: '/apps/ecommerce/orders/details'
              }
            ]
          },
          {
            label: dictionary['navigation'].customers,
            children: [
              {
                label: dictionary['navigation'].list,
                href: '/apps/ecommerce/customers/list'
              },
              {
                label: dictionary['navigation'].details,
                href: '/apps/ecommerce/customers/details/879861',
                exactMatch: false,
                activeUrl: '/apps/ecommerce/customers/details'
              }
            ]
          },
          {
            label: dictionary['navigation'].manageReviews,
            href: '/apps/ecommerce/manage-reviews'
          },
          {
            label: dictionary['navigation'].referrals,
            href: '/apps/ecommerce/referrals'
          },
          {
            label: dictionary['navigation'].settings,
            href: '/apps/ecommerce/settings'
          }
        ]
      },
      {
        label: dictionary['navigation'].academy,
        icon: 'ri-graduation-cap-line',
        children: [
          {
            label: dictionary['navigation'].dashboard,
            href: '/apps/academy/dashboard'
          },
          {
            label: dictionary['navigation'].myCourses,
            href: '/apps/academy/my-courses'
          },
          {
            label: dictionary['navigation'].courseDetails,
            href: '/apps/academy/course-details'
          }
        ]
      },
      {
        label: dictionary['navigation'].logistics,
        icon: 'ri-car-line',
        children: [
          {
            label: dictionary['navigation'].dashboard,
            href: '/apps/logistics/dashboard'
          },
          {
            label: dictionary['navigation'].fleet,
            href: '/apps/logistics/fleet'
          }
        ]
      },
      {
        label: dictionary['navigation'].email,
        icon: 'ri-mail-open-line',
        href: '/apps/email',
        exactMatch: false,
        activeUrl: '/apps/email'
      },
      {
        label: dictionary['navigation'].chat,
        icon: 'ri-wechat-line',
        href: '/apps/chat'
      },
      {
        label: dictionary['navigation'].calendar,
        icon: 'ri-calendar-line',
        href: '/apps/calendar'
      },
      {
        label: dictionary['navigation'].kanban,
        icon: 'ri-drag-drop-line',
        href: '/apps/kanban'
      },
      {
        label: dictionary['navigation'].invoice,
        icon: 'ri-bill-line',
        children: [
          {
            label: dictionary['navigation'].list,
            href: '/apps/invoice/list'
          },
          {
            label: dictionary['navigation'].preview,
            href: '/apps/invoice/preview/4987',
            exactMatch: false,
            activeUrl: '/apps/invoice/preview'
          },
          {
            label: dictionary['navigation'].edit,
            href: '/apps/invoice/edit/4987',
            exactMatch: false,
            activeUrl: '/apps/invoice/edit'
          },
          {
            label: dictionary['navigation'].add,
            href: '/apps/invoice/add'
          }
        ]
      },
      {
        label: dictionary['navigation'].user,
        icon: 'ri-user-line',
        children: [
          {
            label: dictionary['navigation'].list,
            href: '/apps/user/list'
          },
          {
            label: dictionary['navigation'].view,
            href: '/apps/user/view'
          }
        ]
      },
      {
        label: dictionary['navigation'].rolesPermissions,
        icon: 'ri-lock-2-line',
        children: [
          {
            label: dictionary['navigation'].roles,
            href: '/apps/roles'
          },
          {
            label: dictionary['navigation'].permissions,
            href: '/apps/permissions'
          }
        ]
      }
    ]
  },
  {
    label: dictionary['navigation'].formsAndTables,
    isSection: true,
    children: [
      {
        label: dictionary['navigation'].formLayouts,
        icon: 'ri-layout-4-line',
        href: '/forms/form-layouts'
      },
      {
        label: dictionary['navigation'].formValidation,
        icon: 'ri-checkbox-multiple-line',
        href: '/forms/form-validation'
      },
      {
        label: dictionary['navigation'].formWizard,
        icon: 'ri-git-commit-line',
        href: '/forms/form-wizard'
      },
      {
        label: dictionary['navigation'].reactTable,
        icon: 'ri-table-alt-line',
        href: '/react-table'
      },
      {
        label: dictionary['navigation'].formELements,
        icon: 'ri-radio-button-line',
        suffix: <i className='ri-external-link-line text-xl' />,
        href: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/form-elements`,
        target: '_blank'
      },
      {
        label: dictionary['navigation'].muiTables,
        icon: 'ri-table-2',
        href: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/mui-table`,
        suffix: <i className='ri-external-link-line text-xl' />,
        target: '_blank'
      }
    ]
  },  {
    label: dictionary['navigation'].chartsMisc,

    isSection: true,
    children: [
      {
        label: dictionary['navigation'].charts,
        icon: 'ri-bar-chart-2-line',
        children: [
          {
            label: dictionary['navigation'].apex,
            href: '/charts/apex-charts'
          },
          {
            label: dictionary['navigation'].recharts,
            href: '/charts/recharts'
          }
        ]
      },

      {
        label: dictionary['navigation'].foundation,
        icon: 'ri-pantone-line',
        href: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/foundation`,
        suffix: <i className='ri-external-link-line text-xl' />,
        target: '_blank'
      },
      {
        label: dictionary['navigation'].components,
        icon: 'ri-toggle-line',
        href: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/user-interface/components`,
        suffix: <i className='ri-external-link-line text-xl' />,
        target: '_blank'
      },
      {
        label: dictionary['navigation'].menuExamples,
        icon: 'ri-menu-search-line',
        href: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/menu-examples/overview`,
        suffix: <i className='ri-external-link-line text-xl' />,
        target: '_blank'
      },
      {
        label: dictionary['navigation'].raiseSupport,
        icon: 'ri-lifebuoy-line',
        href: 'https://themeselection.com/support',
        suffix: <i className='ri-external-link-line text-xl' />,
        target: '_blank'
      },
      {
        label: dictionary['navigation'].documentation,
        icon: 'ri-book-line',
        href: `${process.env.NEXT_PUBLIC_DOCS_URL}`,
        suffix: <i className='ri-external-link-line text-xl' />,
        target: '_blank'
      },
      {
        label: dictionary['navigation'].others,
        icon: 'ri-more-line',
        children: [
          {
            suffix: {
              label: 'New',
              color: 'info'
            },
            label: dictionary['navigation'].itemWithBadge
          },
          {
            label: dictionary['navigation'].externalLink,
            href: 'https://themeselection.com',
            target: '_blank',
            suffix: <i className='ri-external-link-line text-xl' />
          },
          {
            label: dictionary['navigation'].menuLevels,
            children: [
              {
                label: dictionary['navigation'].menuLevel2
              },
              {
                label: dictionary['navigation'].menuLevel2,
                children: [
                  {
                    label: dictionary['navigation'].menuLevel3
                  },
                  {
                    label: dictionary['navigation'].menuLevel3
                  }
                ]
              }
            ]
          },
          {
            label: dictionary['navigation'].disabledMenu,
            disabled: true
          }
        ]
      }
    ]
  }
]

export default verticalMenuData
