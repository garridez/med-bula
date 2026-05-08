import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

const AuthController = () => import('#controllers/auth_controller')
const PatientsController = () => import('#controllers/patients_controller')
const AppointmentsController = () => import('#controllers/appointments_controller')
const ClinicsController = () => import('#controllers/clinics_controller')

router.get('/', async () => ({ ok: true, app: 'med-bula', version: '0.2.0' }))

router
  .group(() => {
    // ---------- Auth ----------
    router.post('/auth/login', [AuthController, 'login'])
    router.get('/auth/me', [AuthController, 'me']).use(middleware.auth())
    router.post('/auth/logout', [AuthController, 'logout']).use(middleware.auth())

    // ---------- Protected ----------
    router
      .group(() => {
        // Clínica / metadados
        router.get('/clinics/doctors', [ClinicsController, 'doctors'])

        // Pacientes
        router.get('/patients', [PatientsController, 'index'])
        router.get('/patients/:id', [PatientsController, 'show'])
        router.post('/patients', [PatientsController, 'store'])
        router.patch('/patients/:id', [PatientsController, 'update'])
        router.delete('/patients/:id', [PatientsController, 'destroy'])

        // Consultas
        router.get('/appointments', [AppointmentsController, 'index'])
        router.get('/appointments/:id', [AppointmentsController, 'show'])
        router.post('/appointments', [AppointmentsController, 'store'])
        router.patch('/appointments/:id', [AppointmentsController, 'update'])
        router.delete('/appointments/:id', [AppointmentsController, 'destroy'])
      })
      .use(middleware.auth())
  })
  .prefix('/api')
