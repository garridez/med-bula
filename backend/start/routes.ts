import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const AuthController = () => import('#controllers/auth_controller')
const PatientsController = () => import('#controllers/patients_controller')
const AppointmentsController = () => import('#controllers/appointments_controller')
const ClinicsController = () => import('#controllers/clinics_controller')
const MedicalRecordsController = () =>
  import('#controllers/medical_records_controller')
const DocumentsController = () => import('#controllers/documents_controller')
const SignatureController = () => import('#controllers/signature_controller')
const DocumentDeliveryController = () =>
  import('#controllers/document_delivery_controller')
const ProfileController = () => import('#controllers/profile_controller')
const InsurancesController = () => import('#controllers/insurances_controller')
const ReportsController = () => import('#controllers/reports_controller')
const UsersController = () => import('#controllers/users_controller')
const AdminController = () => import('#controllers/admin_controller')

router.get('/', async () => ({ ok: true, app: 'med-bula', version: '0.5.0a' }))

// ==========================================================================
// PUBLIC — sem auth.
// ==========================================================================
router.get('/api/public/r/:token', [DocumentDeliveryController, 'preview'])
router.post('/api/public/r/:token/verify', [DocumentDeliveryController, 'verify'])
router.post('/api/public/r/:token/dispense', [DocumentDeliveryController, 'dispense'])
router.get('/api/public/r/:token/pdf', [DocumentDeliveryController, 'pdf'])
router.get('/api/signature/callback', [SignatureController, 'callback'])

// ==========================================================================
// API
// ==========================================================================
router
  .group(() => {
    // ---------- Auth ----------
    router.post('/auth/login', [AuthController, 'login'])
    router.get('/auth/me', [AuthController, 'me']).use(middleware.auth())
    router.post('/auth/logout', [AuthController, 'logout']).use(middleware.auth())

    // ---------- Protected ----------
    router
      .group(() => {
        // ---- Profile (qualquer role autenticado) ----
        router.get('/profile/me', [ProfileController, 'me'])
        router.patch('/profile/me', [ProfileController, 'update'])
        router.post('/profile/password', [ProfileController, 'changePassword'])

        // ---- Clínica ----
        router.get('/clinics/doctors', [ClinicsController, 'doctors'])
        router.get('/clinic/me', [ClinicsController, 'showMine'])
        router.patch('/clinic/me', [ClinicsController, 'update']) // forbid secretary in controller

        // ---- Relatórios financeiros (médico ou admin) ----
        router
          .group(() => {
            router.get('/reports/financial', [ReportsController, 'financial'])
          })
          .use(middleware.role(['doctor', 'admin', 'super_admin']))

        // ---- Gestão de usuários (admin clínica + doctor consultório) ----
        router
          .group(() => {
            router.get('/users', [UsersController, 'index'])
            router.get('/users/:id', [UsersController, 'show'])
            router.post('/users', [UsersController, 'store'])
            router.patch('/users/:id', [UsersController, 'update'])
            router.delete('/users/:id', [UsersController, 'destroy'])
            router.post('/users/:id/reset-password', [
              UsersController,
              'resetPassword',
            ])
          })
          .use(middleware.role(['doctor', 'admin', 'super_admin']))

        // ---- Super admin (painel do dono do SaaS) ----
        router
          .group(() => {
            router.get('/admin/metrics', [AdminController, 'metrics'])
            router.get('/admin/clinics', [AdminController, 'listClinics'])
            router.get('/admin/clinics/:id', [AdminController, 'showClinic'])
            router.post('/admin/clinics', [AdminController, 'createClinic'])
            router.patch('/admin/clinics/:id', [AdminController, 'updateClinic'])
            router.delete('/admin/clinics/:id', [AdminController, 'destroyClinic'])
            router.post('/admin/impersonate', [AdminController, 'impersonate'])
          })
          .use(middleware.role(['super_admin']))

        // ---- Convênios ----
        // Leitura: todo mundo autenticado (secretária precisa pra agendar)
        router.get('/insurances', [InsurancesController, 'index'])
        router.get('/insurances/by-doctor/:doctorId', [
          InsurancesController,
          'byDoctor',
        ])
        // Escrita: bloqueio extra de role já no próprio controller
        router
          .group(() => {
            router.post('/insurances', [InsurancesController, 'store'])
            router.patch('/insurances/:id', [InsurancesController, 'update'])
            router.delete('/insurances/:id', [InsurancesController, 'destroy'])
            router.post('/insurances/:id/doctors', [
              InsurancesController,
              'upsertDoctorInsurance',
            ])
            router.patch('/doctor-insurances/:id', [
              InsurancesController,
              'updateDoctorInsurance',
            ])
            router.delete('/doctor-insurances/:id', [
              InsurancesController,
              'destroyDoctorInsurance',
            ])
          })
          .use(middleware.role(['doctor', 'admin', 'super_admin']))

        // ---- Pacientes (médico + secretária) ----
        router.get('/patients', [PatientsController, 'index'])
        router.get('/patients/:id', [PatientsController, 'show'])
        router.post('/patients', [PatientsController, 'store'])
        router.patch('/patients/:id', [PatientsController, 'update'])
        router.delete('/patients/:id', [PatientsController, 'destroy'])
        // Histórico clínico — médico/admin only (secretária não vê SOAP)
        router
          .get('/patients/:id/history', [PatientsController, 'history'])
          .use(middleware.role(['doctor', 'admin', 'super_admin']))

        // ---- Consultas (médico + secretária) ----
        router.get('/appointments', [AppointmentsController, 'index'])
        router.get('/appointments/:id', [AppointmentsController, 'show'])
        router.post('/appointments', [AppointmentsController, 'store'])
        router.patch('/appointments/:id', [AppointmentsController, 'update'])
        router.delete('/appointments/:id', [AppointmentsController, 'destroy'])
        router.post('/appointments/:id/payment', [
          AppointmentsController,
          'markPayment',
        ])
        router.delete('/appointments/:id/payment', [
          AppointmentsController,
          'clearPayment',
        ])

        // ---- Prontuário (SÓ médico/admin — secretária BLOQUEADA) ----
        router
          .group(() => {
            router.get('/medical-records', [MedicalRecordsController, 'index'])
            router.get('/medical-records/:id', [MedicalRecordsController, 'show'])
            router.post('/medical-records', [MedicalRecordsController, 'upsert'])
          })
          .use(middleware.role(['doctor', 'admin', 'super_admin']))

        // ---- Documentos (SÓ médico/admin — secretária BLOQUEADA) ----
        router
          .group(() => {
            router.get('/documents', [DocumentsController, 'index'])
            router.get('/documents/:id', [DocumentsController, 'show'])
            router.get('/documents/:id/pdf', [DocumentsController, 'pdf'])
            router.post('/documents', [DocumentsController, 'store'])
            router.delete('/documents/:id', [DocumentsController, 'destroy'])
            router.post('/documents/:id/send-whatsapp', [
              DocumentDeliveryController,
              'sendToWhatsApp',
            ])
          })
          .use(middleware.role(['doctor', 'admin', 'super_admin']))

        // ---- Assinatura (SÓ médico — secretária e admin BLOQUEADA) ----
        router
          .group(() => {
            router.get('/signature/providers', [SignatureController, 'providers'])
            router.post('/signature/sessions', [SignatureController, 'createSession'])
            router.get('/signature/sessions/:id', [SignatureController, 'getSession'])
          })
          .use(middleware.role(['doctor']))
      })
      .use(middleware.auth())
  })
  .prefix('/api')
