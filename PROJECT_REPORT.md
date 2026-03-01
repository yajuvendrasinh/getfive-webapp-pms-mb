# Merchant Bank Command Center - Project Report

This document outlines the architecture, database schema, and file structure of the **Merchant Bank Command Center Chrome Extension**.

---

## 1. Architecture Overview

The application is built as a **Chrome Extension** (Manifest V3) completely relying on **Firebase** for its backend infrastructure.

- **Frontend**: Standard Web Technologies (HTML, CSS, JavaScript).
- **Backend/Database**: Firebase Firestore (NoSQL Document Database).
- **Authentication**: Firebase Authentication using Google OAuth (via `chrome.identity.launchWebAuthFlow`).
- **SDK Variant**: To bypass Chrome Extension MV3 Content Security Policy (CSP) restrictions on dynamic scripts, the application utilizes the **Firebase Compat web SDK** bundled locally within the extension.

---

## 2. Directory Structure

```text
Extension_MB_Projects_DB/
│
├── manifest.json               # Chrome Extension Manifest V3 configuration
├── background.js               # Extension Service Worker (handles routing/auth initiation)
├── icon.png                    # Extension Icon
│
├── dashboard.html              # Main application UI (Single Page Application layout)
├── dashboard.js                # Core business logic, UI rendering, Firestore queries
├── styles.css                  # UI Design system (CSS Variables, Flexbox grids, Modal styling)
│
├── firebase_setup.js           # Firebase configuration and initialization script
├── libs/                       # Locally hosted Firebase Compat SDKs (to satisfy MV3 CSP)
│   ├── firebase-app-compat.js
│   ├── firebase-auth-compat.js
│   └── firebase-firestore-compat.js
│
├── functions/                  # Cloud Functions / Backend triggers (if deployed)
│
└── Scripts (One-time utility tools run directly in browser console):
    ├── patch_remarks_field.js       # Script to migrate old string tasks into the new remarks array format
    ├── patch_requirement_field.js   # Script to append the `requirement: "applicable"` to legacy tasks
    └── seed_master_template.js      # Script to seed the `master_template` collection into Firestore
```

---

## 3. Database Schema (Firestore)

The NoSQL data model revolves heavily around user roles, shared templates, and isolated tracker collections per project.

### `users` collection

Defines the staff members and their system privileges.

- **Document ID**: The user's Google Email address (or UID upon first login).
- **Fields**:
  - `name`: String
  - `email`: String
  - `role`: `"employee"` | `"RM"` | `"admin"` | `"master_admin"` | `"FDD"` | `"Sec"` | ...
  - `assigned_projects`: Array of Project IDs (e.g., `["PR001", "PR003"]`)

### `projects` collection

Stores metadata and configurations for active and completed projects.

- **Document ID**: The Project ID (e.g., `PR004`).
- **Fields**:
  - `Project_ID`: String (e.g., "PR004")
  - `Project_Name`: String
  - `Start_Date`: Firestore Timestamp (Date the project began)
  - `Project_Status`: `"active"` | `"on_hold"` | `"completed"`
  - `completionTime`: Firestore Timestamp (Only present if completed)
  - `Project_RM`, `Project_FDD`, `Project_Sec`, `Project_PC`, `Project_AM`: Email strings for assigned leads.
  - `Project_Additional_mem_1/2/3`: Email strings for extra members.
  - `createdAt`, `createdBy`: Audit trails.

### `master_template` collection

The blueprint collection. Whenever a new project is created, all of these documents are duplicated into a new `{ProjectId}_tracker` collection.

- **Document ID**: Auto-generated string.
- **Fields**:
  - `Phase`: The project phase (e.g., "Phase 1 - Kickoff").
  - `Role`: Which role is responsible for this task (e.g., "FDD").
  - `Activity`: The string describing the task.
  - `Week`: Numerical string (e.g., "1", "2") indicating target completion week.
  - `Weightage`: Priority/score weight of the task.
  - `requirement`: Used to flag tasks (default `""`).

### `{ProjectId}_tracker` collections

Dynamically generated sub-collections that represent the *actual instance* of the master template for a specific project. For example, `PR001_tracker`.

- **Document ID**: Matches the `master_template` document ID it was cloned from.
- **Fields**:
  - Contains all fields from `master_template` (Phase, Role, Activity, Week, Weightage).
  - `projectId`: String (e.g., "PR001").
  - `status`: `"pending"` | `"in_progress"` | `"completed"`.
  - `requirement`: `"applicable"` | `"not_applicable"` | `"already_completed"` | `""`.
  - `assignedTo`: Email string of the employee responsible.
  - `deadline`: String derived from Project Start Date + Target Week (`DD-MMM-YYYY`).
  - `startTime`, `endTime`, `elapsedTime`: Trackers for the stopwatch feature.
  - `remarks`: Array of maps `[{ text: "...", timestamp: "...", author: "..." }]`.

---

## 4. Role-Based Access Control (RBAC)

The UI dynamically hides and exposes functionality based on the authenticated user's `role` fetched from the `users` collection.

| Role | Capabilities |
| :--- | :--- |
| **Employee** (Default) | Can view their Assigned Project. Can interact with tasks assigned specifically to them in the Tracker. Sees their Personal Scorecard. |
| **RM (Relationship Manager)** | Enjoys Employee features + "Manage Team" modal (Assigning tasks to specific members via drag-and-drop). Can view the aggregate "Team Feed". Can toggle `Requirement` dropdowns (N/A / Applicable). |
| **Admin** | Enjoys RM features + "Add Project" modal (Cloning master template). Can access "Manage Projects" to view global status metrics. Scorecard is hidden. |
| **Master Admin** | Enjoys Admin features + "Add User" modal to onboard new employees into Firebase. Scorecard is hidden. |

---

## 5. Core View Components

- **Action Required / This Week Panels**: The default employee view. Filters tasks from the tracker based on `status === "pending" | "in_progress"` and compares deadlines to the physical current date.
- **Dashboard / KPI View**: Renders statistics based on all tasks inside a specific project. Tracks physical adherence to deadlines, On-Time Rates, and generates Phase-by-Phase progress bars alongside an Employee Performance Table.
- **Manage Projects**: Global administrative view. Aggregates all project collections, counting their statuses efficiently while bypassing tasks marked as `not_applicable`, and issues commands to rotate project global status (Active -> On Hold -> Complete).
