import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ActivityFeed } from './components/ActivityFeed';
import { EmptyState } from './components/FeedbackStates';
import { PatientTable } from './components/PatientTable';
import { ReviewQueue } from './components/ReviewQueue';
import { StatCard } from './components/StatCard';
import { demoActivities, demoReviews } from './data/demo-data';
import type { Patient } from './data/types';
import {
  ClinicalReviewsPage,
  FamilyHistoryPage,
  PatientsPage,
  PatientDetailPage,
  RegisterPatientPage,
} from './pages/PatientPages';
import { PedigreePage, ReportsPage, SettingsPage } from './pages/WorkspacePages';
import { ArrowRight, ClipboardList, GitBranch, UsersRound } from 'lucide-react';
import { isStaticDemo, listPatients, registerPatient as createPatient } from './services/api';
import type { PatientSummary } from '@familygene/shared';

function toPatient(patient: PatientSummary): Patient {
  return {
    id: patient.id,
    name: patient.fullName,
    age: patient.age,
    registeredAt: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
      new Date(patient.registeredAt),
    ),
    familyHistory: patient.familyHistory,
    reviewStatus: patient.reviewStatus,
    informationNote: patient.familyHistoryPermission
      ? 'Family-history collection is permitted; review recorded sources and missing details.'
      : 'Family-history permission has not been granted.',
  };
}

function DashboardPage({ patients, error }: { patients: Patient[]; error: string }) {
  const recordedHistories = patients.filter(
    (patient) => patient.familyHistory === 'Recorded',
  ).length;
  const inProgressHistories = patients.filter(
    (patient) => patient.familyHistory === 'In progress',
  ).length;
  const awaitingReviewCount = demoReviews.filter(
    (review) => review.status === 'Awaiting review',
  ).length;

  return (
    <>
      <div className="demo-banner">
        <span className="demo-banner__dot" />
        Demonstration workspace
        <span>All patient records and activity shown here are synthetic.</span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section className="welcome-panel">
        <div>
          <span className="eyebrow">Connecting Family History. Understanding Genetic Risk.</span>
          <h2>Good morning, Dr. Morgan</h2>
          <p>
            Organize family-history information and keep thoughtful clinical reviews moving forward.
          </p>
        </div>
        {isStaticDemo ? (
          <span className="static-demo-label">Read-only public demo</span>
        ) : (
          <Link className="button button--primary" to="/patients/new">
            Register patient <ArrowRight size={17} />
          </Link>
        )}
      </section>

      <section className="stat-grid" aria-label="Demonstration workspace overview">
        <StatCard
          label="Registered patients"
          value={String(patients.length)}
          change="Synthetic demo records"
          icon={<UsersRound size={19} />}
          tone="blue"
        />
        <StatCard
          label="Family histories"
          value={String(recordedHistories + inProgressHistories)}
          change={`${recordedHistories} recorded · ${inProgressHistories} in progress`}
          icon={<ClipboardList size={19} />}
          tone="teal"
        />
        <StatCard
          label="Pedigrees created"
          value="1"
          change="In recent demo activity"
          icon={<GitBranch size={19} />}
          tone="violet"
        />
        <StatCard
          label="Awaiting review"
          value={String(awaitingReviewCount)}
          change={`${demoReviews.length} open demo items`}
          icon={<UsersRound size={19} />}
          tone="amber"
        />
      </section>

      <div className="dashboard-grid">
        <section className="surface-card dashboard-patients">
          <div className="card-heading">
            <div>
              <h3>Recent patients</h3>
              <p>Latest activity in this demo workspace</p>
            </div>
            <Link className="text-link" to="/patients">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <PatientTable patients={patients.slice(0, 4)} compact />
        </section>

        <section className="surface-card dashboard-reviews">
          <div className="card-heading">
            <div>
              <h3>Clinical review queue</h3>
              <p>Cases needing a clinician’s attention</p>
            </div>
            <Link aria-label="View all clinical reviews" className="icon-link" to="/reviews">
              <ArrowRight size={17} />
            </Link>
          </div>
          <ReviewQueue reviews={demoReviews.slice(0, 3)} compact />
          <Link className="queue-footer" to="/reviews">
            Open review queue <ArrowRight size={15} />
          </Link>
        </section>

        <section className="surface-card dashboard-activity">
          <div className="card-heading">
            <div>
              <h3>Recent activity</h3>
              <p>Updates from the synthetic workspace</p>
            </div>
            <span className="activity-period">Last 7 days</span>
          </div>
          <ActivityFeed activities={demoActivities} />
        </section>
      </div>
      <p className="clinical-note">
        Family history is not a diagnosis. Review incomplete or unverified information with the care
        team.
      </p>
    </>
  );
}

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const handlePatientUpdate = (event: Event) => {
      const { detail } = event as CustomEvent<PatientSummary[]>;
      setPatients(detail.map(toPatient));
    };
    window.addEventListener('familygene:patients-updated', handlePatientUpdate);
    listPatients()
      .then((records) => {
        if (active) setPatients(records.map(toPatient));
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(error instanceof Error ? error.message : 'Could not load patients.');
      });
    return () => {
      active = false;
      window.removeEventListener('familygene:patients-updated', handlePatientUpdate);
    };
  }, []);

  async function registerPatient(
    input: Parameters<typeof createPatient>[0],
    idempotencyKey: string,
  ) {
    const patient = await createPatient(input, idempotencyKey);
    setPatients((currentPatients) => [toPatient(patient), ...currentPatients]);
    return patient;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage patients={patients} error={loadError} />} />
        <Route path="patients" element={<PatientsPage patients={patients} />} />
        <Route path="patients/new" element={<RegisterPatientPage onRegister={registerPatient} />} />
        <Route path="patients/:patientId" element={<PatientDetailPage />} />
        <Route path="family-history" element={<FamilyHistoryPage />} />
        <Route path="pedigree" element={<PedigreePage />} />
        <Route path="reviews" element={<ClinicalReviewsPage />} />
        <Route path="reports" element={<ReportsPage patients={patients} />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="*"
          element={
            <EmptyState
              title="Page not found"
              description="This workspace page is not available. Return to the dashboard to continue."
              action={
                <Link className="button button--primary" to="/">
                  Go to dashboard
                </Link>
              }
            />
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
