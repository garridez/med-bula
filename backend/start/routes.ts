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

        // ---- Pacientes (médico + secretária) ----
        router.get('/patients', [PatientsController, 'index'])
        router.get('/patients/:id', [PatientsController, 'show'])
        router.post('/patients', [PatientsController, 'store'])
        router.patch('/patients/:id', [PatientsController, 'update'])
        router.delete('/patients/:id', [PatientsController, 'destroy'])

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
