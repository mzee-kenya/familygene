import { useState } from 'react';
import { ArrowRight, BarChart3, Bell, Download, GitBranch, Info, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Patient } from '../data/types';
import { PageHeader } from '../components/PageHeader';

export function PedigreePage() {
  return (
    <>
      <PageHeader
        title="Pedigree builder"
        description="Prepare a family relationship diagram from documented history."
      />
      <section className="surface-card workspace-intro">
        <span className="workspace-intro__icon">
          <GitBranch size={22} />
        </span>
        <span className="eyebrow">Pedigree workspace</span>
        <h3>Choose a patient to get started</h3>
        <p>
          Pedigree tools are being prepared for a future phase. Relationship details should be
          confirmed with the patient before interpretation.
        </p>
        <Link className="button button--primary" to="/patients">
          Select a demo patient <ArrowRight size={17} />
        </Link>
      </section>
      <div className="info-callout workspace-safety">
        <Info size={17} />
        <p>
          Family diagrams can contain gaps or unverified relationships. They are not diagnostic
          findings.
        </p>
      </div>
    </>
  );
}

export function ReportsPage({ patients }: { patients: Patient[] }) {
  function downloadDemoReport() {
    const rows = [
      ['Patient ID', 'Name', 'Age', 'Registered', 'Family history', 'Review status'],
      ...patients.map((patient) => [
        patient.id,
        patient.name,
        String(patient.age),
        patient.registeredAt,
        patient.familyHistory,
        patient.reviewStatus,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'familygene-demo-patients.csv';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Export a synthetic patient list for demonstration purposes."
      />
      <section className="surface-card report-card">
        <span className="workspace-intro__icon">
          <BarChart3 size={22} />
        </span>
        <div>
          <span className="eyebrow">Demonstration export</span>
          <h3>Patient overview</h3>
          <p>
            Download a CSV containing fictional patient identifiers, ages, registration dates, and
            workflow statuses.
          </p>
          <button className="button button--primary" onClick={downloadDemoReport} type="button">
            <Download size={17} /> Download demo CSV
          </button>
        </div>
      </section>
      <p className="clinical-note">
        This export uses synthetic demo records only. Clinical outcome reporting is not available in
        this prototype.
      </p>
    </>
  );
}

export function SettingsPage() {
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage preferences for this demonstration workspace."
      />
      <div className="settings-layout">
        <section className="surface-card settings-card">
          <div className="card-heading">
            <div>
              <h3>Account preferences</h3>
              <p>Demo clinician account</p>
            </div>
            <ShieldCheck size={19} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Workspace data</strong>
              <span>Synthetic records only · stored in local SQLite.</span>
            </div>
            <span className="privacy-chip">Demo</span>
          </div>
          <div className="setting-row">
            <div>
              <strong>Review reminders</strong>
              <span>Show in-app prompts for demo review-queue changes.</span>
            </div>
            <button
              aria-checked={emailUpdates}
              aria-label="Toggle review reminders"
              className={`switch-control${emailUpdates ? ' switch-control--on' : ''}`}
              onClick={() => {
                setEmailUpdates((enabled) => !enabled);
                setSaved(false);
              }}
              role="switch"
              type="button"
            >
              <span />
            </button>
          </div>
          <div className="settings-actions">
            {saved && (
              <span aria-live="polite" className="success-message">
                <ShieldCheck size={16} /> Preferences saved for this session.
              </span>
            )}
            <button className="button button--primary" onClick={() => setSaved(true)} type="button">
              Save preferences
            </button>
          </div>
        </section>
        <aside className="surface-card settings-notice">
          <Bell size={19} />
          <h3>Prototype settings</h3>
          <p>
            Preferences are kept in this browser session only. No account data is transmitted or
            stored.
          </p>
        </aside>
      </div>
    </>
  );
}
