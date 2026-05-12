import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import Clinic from '#models/clinic'
import User from '#models/user'
import Patient from '#models/patient'
import Appointment from '#models/appointment'
import Insurance from '#models/insurance'
import DoctorInsurance from '#models/doctor_insurance'

/**
 * Idempotente — pode rodar em todo container start sem quebrar.
 * Usa firstOrCreate baseado em chaves únicas (email, cpf+clinic).
 */
export default class extends BaseSeeder {
  async run() {
    // 1. Clínica
    const clinic = await Clinic.firstOrCreate(
      { name: 'Clínica Bula Teste' },
      {
        cnpj: '12.345.678/0001-90',
        phone: '(31) 3000-0000',
        address: 'Rua das Flores, 100 - Belo Horizonte/MG',
        plan: 'consultorio',
        primaryColor: '#e53935',
        isActive: true,
      }
    )

    // 2. Super admin
    await User.firstOrCreate(
      { email: 'super@bula.com.br' },
      {
        clinicId: null,
        fullName: 'Super Admin Bula',
        password: 'senha123',
        role: 'super_admin',
        isActive: true,
      }
    )

    // 3. Admin
    await User.firstOrCreate(
      { email: 'admin@clinica.com.br' },
      {
        clinicId: clinic.id,
        fullName: 'Admin Clínica',
        password: 'senha123',
        role: 'admin',
        isActive: true,
      }
    )

    // 4. Médico
    const doctor = await User.firstOrCreate(
      { email: 'medico@clinica.com.br' },
      {
        clinicId: clinic.id,
        fullName: 'Gustavo Felipe',
        password: 'senha123',
        cpf: '064.131.076-50',
        phone: '(31) 99999-0001',
        role: 'doctor',
        crm: '12345',
        crmUf: 'MG',
        specialty: 'Clínica Geral',
        address: 'Avenida Professor Manoel Martins, 687 - Conselheiro Lafaiete/MG',
        consultationPrice: 250,
        signatureProvider: 'vidaas',
        isActive: true,
      }
    )

    // 5. Secretária
    await User.firstOrCreate(
      { email: 'sec@clinica.com.br' },
      {
        clinicId: clinic.id,
        fullName: 'Secretária Maria',
        password: 'senha123',
        role: 'secretary',
        permissions: {
          agenda: true,
          patients: true,
          billing: true,
          prontuario: false,
          documents: false,
        },
        isActive: true,
      }
    )

    // 6. Pacientes (chave: clinic_id + cpf — bate com o unique da migration)
    const patient1 = await Patient.firstOrCreate(
      { clinicId: clinic.id, cpf: '999.888.777-66' },
      {
        fullName: 'João da Silva',
        birthDate: DateTime.fromISO('1985-03-12'),
        gender: 'M',
        weightKg: 78.5,
        heightCm: 175,
        phone: '(31) 98888-1234', // OTP: 1234
        email: 'joao@example.com',
        city: 'Belo Horizonte',
        state: 'MG',
        isActive: true,
      }
    )

    const patient2 = await Patient.firstOrCreate(
      { clinicId: clinic.id, cpf: '888.777.666-55' },
      {
        fullName: 'Maria Souza',
        birthDate: DateTime.fromISO('1992-07-25'),
        gender: 'F',
        weightKg: 62,
        heightCm: 165,
        phone: '(31) 97777-5678', // OTP: 5678
        email: 'maria@example.com',
        city: 'Belo Horizonte',
        state: 'MG',
        isActive: true,
      }
    )

    // 7. Consultas — só cria se ainda não tiver nenhuma na clínica
    const apptCount = await Appointment.query()
      .where('clinic_id', clinic.id)
      .count('* as total')
      .first()

    if (Number(apptCount?.$extras.total ?? 0) === 0) {
      const today = DateTime.now().startOf('day')
      await Appointment.createMany([
        {
          clinicId: clinic.id,
          doctorId: doctor.id,
          patientId: patient1.id,
          scheduledAt: today.plus({ days: 1, hours: 9 }),
          durationMinutes: 30,
          status: 'scheduled',
          reason: 'Consulta de rotina',
          price: 250,
          paymentStatus: 'none',
          reminderSent: false,
        },
        {
          clinicId: clinic.id,
          doctorId: doctor.id,
          patientId: patient2.id,
          scheduledAt: today.plus({ days: 1, hours: 10 }),
          durationMinutes: 30,
          status: 'confirmed',
          reason: 'Retorno',
          price: 200,
          paymentStatus: 'paid',
          paymentMethod: 'pix',
          reminderSent: true,
          reminderSentAt: today.minus({ days: 1 }),
        },
        {
          clinicId: clinic.id,
          doctorId: doctor.id,
          patientId: patient1.id,
          scheduledAt: today.plus({ days: 3, hours: 14 }),
          durationMinutes: 45,
          status: 'scheduled',
          reason: 'Primeira consulta',
          price: 350,
          paymentStatus: 'pending',
          reminderSent: false,
        },
      ])
    }

    // 7. Convênios de exemplo (Drop 5b)
    const insuranceCount = await Insurance.query()
      .where('clinic_id', clinic.id)
      .count('* as total')
      .first()
    if (Number(insuranceCount?.$extras.total ?? 0) === 0) {
      const unimed = await Insurance.create({
        clinicId: clinic.id,
        name: 'Unimed',
        isActive: true,
      })
      const bradesco = await Insurance.create({
        clinicId: clinic.id,
        name: 'Bradesco Saúde',
        isActive: true,
      })
      await DoctorInsurance.createMany([
        { doctorId: doctor.id, insuranceId: unimed.id, price: 90, isActive: true },
        {
          doctorId: doctor.id,
          insuranceId: bradesco.id,
          price: 110,
          isActive: true,
        },
      ])
    }

    // 8. Drop 5d — Clínica multi-médico de exemplo
    const multiClinic = await Clinic.firstOrCreate(
      { name: 'Clínica Multi Especialidades' },
      {
        name: 'Clínica Multi Especialidades',
        cnpj: '98.765.432/0001-10',
        phone: '(31) 3000-0001',
        address: 'Rua das Acácias, 200 - Belo Horizonte/MG',
        plan: 'clinica',
      } as any
    )

    await User.firstOrCreate(
      { email: 'admin@multi.com.br' },
      {
        clinicId: multiClinic.id,
        fullName: 'Mariana Souza',
        email: 'admin@multi.com.br',
        password: 'senha123',
        role: 'admin',
        phone: '(31) 99999-1000',
        isActive: true,
      } as any
    )

    const doc1 = await User.firstOrCreate(
      { email: 'rafael@multi.com.br' },
      {
        clinicId: multiClinic.id,
        fullName: 'Rafael Mendes',
        email: 'rafael@multi.com.br',
        password: 'senha123',
        cpf: '111.222.333-44',
        phone: '(31) 99999-1001',
        role: 'doctor',
        crm: '54321',
        crmUf: 'MG',
        specialty: 'Cardiologia',
        consultationPrice: 350,
        signatureProvider: 'vidaas',
        splitType: 'percentual',
        splitValue: 30, // clínica fica com 30%
        isActive: true,
      } as any
    )

    const doc2 = await User.firstOrCreate(
      { email: 'beatriz@multi.com.br' },
      {
        clinicId: multiClinic.id,
        fullName: 'Beatriz Lima',
        email: 'beatriz@multi.com.br',
        password: 'senha123',
        cpf: '222.333.444-55',
        phone: '(31) 99999-1002',
        role: 'doctor',
        crm: '67890',
        crmUf: 'MG',
        specialty: 'Pediatria',
        consultationPrice: 300,
        signatureProvider: 'vidaas',
        splitType: 'absoluto',
        splitValue: 80, // clínica fica com R$80 fixos
        isActive: true,
      } as any
    )

    await User.firstOrCreate(
      { email: 'sec.multi@multi.com.br' },
      {
        clinicId: multiClinic.id,
        fullName: 'Camila Ferreira',
        email: 'sec.multi@multi.com.br',
        password: 'senha123',
        phone: '(31) 99999-1003',
        role: 'secretary',
        isActive: true,
      } as any
    )

    // Convênios da clínica multi
    const multiUnimedCount = await Insurance.query()
      .where('clinic_id', multiClinic.id)
      .count('* as total')
      .first()
    if (Number(multiUnimedCount?.$extras.total ?? 0) === 0) {
      const multiUnimed = await Insurance.create({
        clinicId: multiClinic.id,
        name: 'Unimed',
        isActive: true,
      })
      await DoctorInsurance.createMany([
        { doctorId: doc1.id, insuranceId: multiUnimed.id, price: 130, isActive: true },
        { doctorId: doc2.id, insuranceId: multiUnimed.id, price: 100, isActive: true },
      ])
    }

    console.log('✅ Seed ok — login: medico@clinica.com.br / senha123')
  }
}
