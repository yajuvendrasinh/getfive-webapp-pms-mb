// dashboard.js - Compat SDK Version
// Assumes 'firebase', 'auth', 'db', 'provider' are available globally from firebase_setup.js

// DOM Elements
const loginContainer = document.getElementById("login-container");
const appContainer = document.getElementById("app-container");
const googleLoginBtn = document.getElementById("google-login-btn");
const userPhoto = document.getElementById("user-photo");
const userName = document.getElementById("user-name");
const userRoleDisplay = document.getElementById("user-role");
const activeProjectSelect = document.getElementById("active-project");
const actionRequiredList = document.getElementById("action-required-list");
const thisWeekList = document.getElementById("this-week-list");
const rmControls = document.getElementById("rm-controls");
// Scorecard elements
const scoreTotalEl = document.getElementById("score-total");
const scoreCompletedEl = document.getElementById("score-completed");
const scoreOverdueEl = document.getElementById("score-overdue");
const scoreLateEl = document.getElementById("score-late");
const scoreFinalEl = document.getElementById("score-final");
const toggleCompletedBtn = document.getElementById("toggle-completed-btn");
const completedTasksList = document.getElementById("completed-tasks-list");
const manageTeamBtn = document.getElementById("manage-team-btn");
const assignTasksBtn = document.getElementById("assign-tasks-btn");

// Assign mode state
let assignMode = false;
let showCompletedTasks = false;
let projectTeamCache = []; // { role, name, email } for current project
const manageTeamModal = document.getElementById("manage-team-modal");
const closeModalSpan = document.querySelector(".close-modal");
const teamMappingForm = document.getElementById("team-mapping-form");
const saveTeamBtn = document.getElementById("save-team-btn");
const teamFeedToggle = document.getElementById("team-feed-toggle");

// Add User Modal Elements
const addUserBtn = document.getElementById("add-user-btn");
const addUserModal = document.getElementById("add-user-modal");
const closeAddUserModal = document.getElementById("close-add-user-modal");
const newUserName = document.getElementById("new-user-name");
const newUserEmail = document.getElementById("new-user-email");
const newUserRole = document.getElementById("new-user-role");
const newUserProject = document.getElementById("new-user-project");
const saveUserBtn = document.getElementById("save-user-btn");

// Add Project Modal Elements
const addProjectBtn = document.getElementById("add-project-btn");
const addProjectModal = document.getElementById("add-project-modal");
const closeAddProjectModal = document.getElementById("close-add-project-modal");
const saveProjectBtn = document.getElementById("save-project-btn");

// Manage Projects Elements
const manageProjectsBtn = document.getElementById("manage-projects-btn");
const nextWeekTasksList = document.getElementById("next-week-tasks-list");
const showNextWeekBtn = document.getElementById("show-next-week-btn");
const manageProjectsView = document.getElementById("manage-projects-view");
const activeProjectsList = document.getElementById("active-projects-list");
const completedProjectsList = document.getElementById("completed-projects-list");
const toggleCompletedProjectsBtn = document.getElementById("toggle-completed-projects-btn");
const backToDashboardBtn = document.getElementById("back-to-dashboard-btn");


let currentUser = null;
let userData = null;
let projectStartDates = {};
let unsubscribeTasks = null;
let activeTaskCard = null;
let currentTimerInterval = null;
let secondsElapsed = 0;
let showNextWeekTasks = false; // For RM view

// Hardcoded Master Admin email
const MASTER_ADMIN_EMAIL = "yajuvendra.sinh@getfive.in";

// Supabase Auth Listener
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
        if (currentUser && currentUser.id === session.user.id) {
            return; // Prevent duplicate execution from rapid successive auth events
        }
        currentUser = session.user;
        loginContainer.classList.add("hidden");
        appContainer.classList.remove("hidden");
        // Supabase stores email in session.user.email
        await loadUserData(session.user.id);
    } else {
        currentUser = null;
        loginContainer.classList.remove("hidden");
        appContainer.classList.add("hidden");
    }
});

// Login
console.log("Current Extension ID:", chrome.runtime.id);

// Web Application OAuth Client ID (Firebase auto-created) — required for launchWebAuthFlow
const WEB_CLIENT_ID = "431860779602-9ve1p15p4fs79lf3i2enrm7sc5ruh0pf.apps.googleusercontent.com";

// Login with chrome.identity.launchWebAuthFlow (works in Chrome + Brave + all Chromium)
googleLoginBtn.addEventListener("click", async () => {
    console.log("Sign-in button clicked for Extension ID:", chrome.runtime.id);

    const redirectURL = chrome.identity.getRedirectURL();
    console.log("Redirect URL:", redirectURL);

    // To use Supabase signInWithIdToken, we need an id_token, not just an access_token.
    // In Chrome Extensions, launchWebAuthFlow can return an id_token if configured correctly
    // However, Supabase also supports implicit grant natively by redirecting to their OAuth handler.

    // Construct the Supabase OAuth URL manually to avoid SDK redirect issues
    const provider = 'google';

    // Fallback to manually constructing the URL using the project URL
    // Format: https://<project-ref>.supabase.co/auth/v1/authorize?provider=google&redirect_to=<url>
    const projectUrl = "https://ooytacbfpicvkfrthsax.supabase.co";
    const authURL = `${projectUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectURL)}`;

    console.log("Launching web auth flow for Supabase:", authURL);

    chrome.identity.launchWebAuthFlow(
        { url: authURL, interactive: true },
        async function (responseUrl) {
            if (chrome.runtime.lastError) {
                console.error("Auth Flow Error:", chrome.runtime.lastError);
                alert("Auth Error: " + chrome.runtime.lastError.message);
                return;
            }

            if (!responseUrl) {
                alert("No response from auth flow.");
                return;
            }

            // Supabase returns access_token and refresh_token in the URL hash
            const url = new URL(responseUrl);
            const params = new URLSearchParams(url.hash.substring(1));
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");

            if (!accessToken) {
                console.error("No access token found in response URL", responseUrl);
                alert("Login failed: No access token received.");
                return;
            }

            console.log("Tokens received, establishing Supabase session...");

            const { data, error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error) {
                console.error("Supabase Auth Error:", error);
                alert("Login failed: " + error.message);
            } else {
                console.log("Logged in successfully!", data.user);
            }
        }
    );
});

async function loadUserData(uid) {
    try {
        const isMasterAdmin = currentUser.email === MASTER_ADMIN_EMAIL;

        // Use raw fetch to bypass `supabase-js` hanging bug on 406 Not Acceptable (0 rows)
        const projectUrl = "https://ooytacbfpicvkfrthsax.supabase.co";
        const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9veXRhY2JmcGljdmtmcnRoc2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTQ1NTYsImV4cCI6MjA4NzU3MDU1Nn0.ouPepi2oGq1HNuzJqRznjOS4iO0OnpRCM82TL5oXv88";

        const defaultHeaders = {
            "apikey": anonKey,
            "Authorization": "Bearer " + anonKey,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        };
        const singleHeaders = { ...defaultHeaders, "Accept": "application/vnd.pgrst.object+json" };

        const url = `${projectUrl}/rest/v1/users?select=*&email=eq.${encodeURIComponent(currentUser.email)}`;
        const res = await fetch(url, { headers: singleHeaders });

        let userRecord = null;
        let isPgrst116 = false;

        if (res.status === 200) {
            userRecord = await res.json();
        } else if (res.status === 406) {
            isPgrst116 = true;
        } else {
            console.error("Supabase REST Fetch Error:", await res.text());
        }

        if (userRecord) {
            // User exists 
            userData = userRecord;

            // Ensure the uid is stored inside the doc for reference if needed
            if (userData.uid !== uid) {
                userData.uid = uid;
                await fetch(`${projectUrl}/rest/v1/users?email=eq.${encodeURIComponent(currentUser.email)}`, {
                    method: 'PATCH',
                    headers: defaultHeaders,
                    body: JSON.stringify({ uid: uid })
                });
            }

            if (isMasterAdmin && userData.role !== "master_admin") {
                userData.role = "master_admin";
                await fetch(`${projectUrl}/rest/v1/users?email=eq.${encodeURIComponent(currentUser.email)}`, {
                    method: 'PATCH',
                    headers: defaultHeaders,
                    body: JSON.stringify({ role: "master_admin" })
                });
            }

            renderSidebar(currentUser, userData);

            // Replaced anti-pattern 'assigned_projects' array with dynamic query
            try {
                let assignedProjectIds = [];
                if (userData.role === "master_admin" || userData.role === "admin") {
                    // Admin logic handles pulling "all" inside loadProjects itself
                    loadProjects([]);
                } else {
                    // Standard user: find projects where they are explicitly assigned to a role column
                    const email = currentUser.email;
                    const { data: myProjects, error: pError } = await supabaseClient
                        .from('projects')
                        .select('id')
                        .or(`Project_RM.eq."${email}",Project_FDD.eq."${email}",Project_Sec.eq."${email}",Project_PC.eq."${email}",Project_AM.eq."${email}",Project_Additional_mem_1.eq."${email}",Project_Additional_mem_2.eq."${email}",Project_Additional_mem_3.eq."${email}"`);

                    if (pError) throw pError;
                    if (myProjects) {
                        assignedProjectIds = myProjects.map(p => p.id);
                    }
                    loadProjects(assignedProjectIds);
                }
            } catch (err) {
                console.error("Error fetching assigned projects:", err);
                loadProjects([]); // Fallback
            }

        } else if (isPgrst116) {
            // PGRST116 means zero rows returned (user not found)

            // Auto-create Master Admin profile on first login if it doesn't exist
            if (isMasterAdmin) {
                userData = {
                    name: currentUser.user_metadata?.full_name || "Master Admin",
                    email: MASTER_ADMIN_EMAIL,
                    role: "master_admin",
                    uid: uid,
                    Assigned_Project: ""
                };

                await fetch(`${projectUrl}/rest/v1/users`, {
                    method: 'POST',
                    headers: defaultHeaders,
                    body: JSON.stringify(userData)
                });

                console.log("Master Admin profile created.");
                renderSidebar(currentUser, userData);
                loadProjects([]);
            } else {
                console.warn("User profile not found in 'users' table.");
                userName.textContent = currentUser.user_metadata?.full_name || currentUser.email;
                userRoleDisplay.textContent = "Role: Unauthorized";

                // Display that they have no projects and are unauthorized
                userData = { role: "Unknown" };
                renderSidebar(currentUser, userData);
            }
        }
    } catch (e) {
        console.error("Error loading user data exception:", e);
    }
}

function renderSidebar(user, data) {
    userPhoto.src = user.photoURL || "icon.png";
    userName.textContent = data.name || user.displayName;
    userRoleDisplay.textContent = `Role: ${data.role || "N/A"}`;

    const adminControls = document.getElementById("admin-controls");

    // RM controls (Manage Team, Team Feed) for RM, admin, and master_admin
    if (data.role === "RM" || data.role === "admin" || data.role === "master_admin") {
        rmControls.classList.remove("hidden");
    } else {
        rmControls.classList.add("hidden");
    }

    // Admin controls (Add User, Add Project) only for master_admin and admin
    if (data.role === "master_admin" || data.role === "admin") {
        adminControls.classList.remove("hidden");
    } else {
        adminControls.classList.add("hidden");
    }

    // Hide Scorecard for Admin/Master Admin (they manage, don't need personal stats)
    const userScorecard = document.getElementById("user-scorecard");
    if (userScorecard) {
        if (data.role === "master_admin" || data.role === "admin") {
            userScorecard.style.display = "none";
        } else {
            userScorecard.style.display = "";
        }
    }

    // Show Dashboard Toggle for Admin/Master Admin
    const viewToggle = document.getElementById("view-toggle-container");
    if (viewToggle) {
        if (data.role === "master_admin" || data.role === "admin") {
            viewToggle.classList.remove("hidden");
        } else {
            viewToggle.classList.add("hidden");
        }
    }
}

async function loadProjects(projectIds) {
    const selectorDiv = document.querySelector(".project-selector");
    activeProjectSelect.innerHTML = '<option value="" disabled selected>Select Project</option>';

    // Admin/Master Admin sees ALL projects (always dropdown)
    if (userData && (userData.role === "master_admin" || userData.role === "admin")) {
        // Ensure dropdown is visible
        activeProjectSelect.style.display = "";
        const existingLabel = selectorDiv.querySelector(".single-project-label");
        if (existingLabel) existingLabel.remove();

        // Also clear dashboard selector
        const dashSelect = document.getElementById("dashboard-project-select");
        if (dashSelect) dashSelect.innerHTML = '<option value="" disabled selected>Select Project</option>';

        try {
            const { data: allProjects, error } = await supabaseClient.from('projects').select('*');
            if (error) throw error;

            let firstProjectId = null;
            allProjects.forEach(pData => {
                // Prevent duplicate options if loadProjects is somehow called concurrently
                if (activeProjectSelect.querySelector(`option[value="${pData.id}"]`)) return;

                // Store Start Date for Filtering
                const sDate = pData.startDate || pData.Start_Date;
                if (sDate) {
                    projectStartDates[pData.id] = new Date(sDate);
                }

                const option = document.createElement("option");
                option.value = pData.id;
                option.textContent = `${pData.Project_Name || pData.projectName || "Unnamed"} (${pData.id})`;
                activeProjectSelect.appendChild(option);

                if (dashSelect) dashSelect.appendChild(option.cloneNode(true));

                if (!firstProjectId) firstProjectId = pData.id;
            });

            // Auto-select first project if available
            if (firstProjectId) {
                activeProjectSelect.value = firstProjectId;
                loadProjectTasks(firstProjectId);
            }
        } catch (e) {
            console.error("Error loading all projects for Admin:", e);
        }
        return;
    }

    if (!projectIds || projectIds.length === 0) return;

    // Single project — show as plain text, display dropdown hidden but set value
    if (projectIds.length === 1) {
        const pid = projectIds[0];
        try {
            const { data: pData, error } = await supabaseClient.from('projects').select('*').eq('id', pid).single();
            if (pData) {
                const pName = pData.Project_Name || pData.projectName || pid;

                // Hide select, show label
                activeProjectSelect.style.display = "none";
                activeProjectSelect.innerHTML = `<option value="${pid}" selected>${pName}</option>`;
                activeProjectSelect.value = pid; // Ensure value is set

                // Populate dashboard selector (Single Option)
                const dashSelect = document.getElementById("dashboard-project-select");
                if (dashSelect) {
                    dashSelect.innerHTML = `<option value="${pid}" selected>${pName}</option>`;
                    dashSelect.value = pid;
                }

                let label = selectorDiv.querySelector(".single-project-label");
                if (!label) {
                    label = document.createElement("span");
                    label.className = "single-project-label";
                    label.style.fontWeight = "bold";
                    label.style.paddingLeft = "10px";
                    selectorDiv.appendChild(label);
                }
                label.textContent = `${pName} (${pid})`;

                // LOAD TASKS!
                loadProjectTasks(pid);
            }
        } catch (e) {
            console.error("Error fetching single project:", e);
        }
        return;
    }


    // Multiple projects — show dropdown as usual
    activeProjectSelect.style.display = "";
    const existingLabel = selectorDiv.querySelector(".single-project-label");
    if (existingLabel) existingLabel.remove();

    // Clear dashboard selector before populating
    const dashSelect = document.getElementById("dashboard-project-select");
    if (dashSelect) dashSelect.innerHTML = '<option value="" disabled selected>Select Project</option>';

    for (const pid of projectIds) {
        try {
            // Prevent duplicate options if loadProjects is somehow called concurrently
            if (activeProjectSelect.querySelector(`option[value="${pid}"]`)) continue;

            const { data: pData, error } = await supabaseClient.from('projects').select('*').eq('id', pid).single();
            if (pData) {
                const option = document.createElement("option");
                option.value = pid;
                option.textContent = `${pData.Project_Name || pData.projectName || "Unnamed"} (${pid})`;
                activeProjectSelect.appendChild(option);

                // Also populate dashboard selector
                const dashSelect = document.getElementById("dashboard-project-select");
                if (dashSelect) {
                    dashSelect.appendChild(option.cloneNode(true));
                }
            }
        } catch (e) {
            console.error(`Error loading project ${pid}:`, e);
        }
    }
}

// Handle Dashboard Project Change
const dashSelect = document.getElementById("dashboard-project-select");
if (dashSelect) {
    dashSelect.addEventListener("change", (e) => {
        const projectId = e.target.value;
        // Sync with sidebar selector
        if (activeProjectSelect) activeProjectSelect.value = projectId;
        // Load tasks
        loadProjectTasks(projectId);
    });
}

activeProjectSelect.addEventListener("change", (e) => {
    const projectId = e.target.value;
    loadProjectTasks(projectId);
    if (userData.role === "RM" || userData.role === "master_admin") {
        setupTeamManagement(projectId);
    }
});

// Global variable for dashboard
let allProjectTasks = [];

function loadProjectTasks(projectId) {
    if (unsubscribeTasks) {
        supabaseClient.removeChannel(unsubscribeTasks);
        unsubscribeTasks = null;
    }

    const isRM = userData.role === "RM" || userData.role === "admin" || userData.role === "master_admin";
    const showTeamFeed = isRM && teamFeedToggle.checked;

    // First, get the project's start date and team members
    supabaseClient.from('projects').select('*').eq('id', projectId).single().then(async ({ data: pData, error }) => {
        let projectStartDate = null;
        projectTeamCache = []; // Reset team cache

        if (pData) {
            // Standardized date field parsing (handling multiple legacy formats)
            if (pData.Start_Date) {
                projectStartDate = new Date(pData.Start_Date);
            }

            // Build team cache for assign mode dropdowns and dashboard
            const teamFields = [
                { field: "Project_RM", label: "RM" },
                { field: "Project_FDD", label: "FDD" },
                { field: "Project_Sec", label: "Sec" },
                { field: "Project_PC", label: "PC" },
                { field: "Project_AM", label: "AM" },
                { field: "Project_Additional_mem_1", label: "Member" },
                { field: "Project_Additional_mem_2", label: "Member" },
                { field: "Project_Additional_mem_3", label: "Member" }
            ];

            for (const { field, label } of teamFields) {
                const emailStr = pData[field];
                if (emailStr && emailStr.trim() !== "") {
                    const emails = emailStr.split(",").map(e => e.trim()).filter(e => e !== "");
                    for (const email of emails) {
                        // Try to get the user's name
                        let name = email;
                        try {
                            const { data: userDoc } = await supabaseClient.from('users').select('name').eq('email', email).single();
                            if (userDoc && userDoc.name) {
                                name = userDoc.name;
                            }
                        } catch (e) { /* use email as fallback */ }
                        projectTeamCache.push({ role: label, name, email });
                    }
                }
            }
        } else if (error) {
            console.error("Error fetching project start date:", error);
            return;
        }

        const currentWeek = calculateCurrentWeek(projectStartDate);
        console.log(`DEBUG: Project ${projectId}: Start=${projectStartDate}, Current Week=${currentWeek}`);

        // Helper function to process tasks and render
        const processAndRenderTasks = (allTasks) => {
            // Store for Dashboard
            allProjectTasks = allTasks;
            console.log(`DEBUG: Processing ${allTasks.length} total tasks from tracker.`);

            // If Dashboard is active, render it
            const dashboardToggle = document.getElementById("dashboard-toggle");
            if (dashboardToggle && dashboardToggle.checked) {
                renderDashboard();
            }

            // Filter tasks: only show up to current week + carry forward pending/in-progress
            // Also exclude 'not_applicable' tasks from all views
            let visibleTasks = allTasks.filter(task => {
                if (task.requirement === "not_applicable") return false; // Hidden from all views
                if (task.status === "in_progress") return true;
                if (task.status === "on_hold") return true; // Show On Hold too
                if (task.status === "awaiting_approval") return true;

                const maxVisibleWeek = showNextWeekTasks && isRM ? currentWeek + 1 : currentWeek;
                if (task.status === "pending" && task.targetWeek <= maxVisibleWeek) return true;
                if (task.status === "completed" && task.targetWeek <= maxVisibleWeek) return true;
                return false;
            });
            console.log(`DEBUG: ${visibleTasks.length} tasks visible after week filtering.`);

            // Scorecard Calculation (Always for Current User, excluding not_applicable)
            const userTasks = allTasks.filter(t => {
                if (t.requirement === "not_applicable") return false;
                if (!t.actualAssigneeEmail) return false;
                const emails = t.actualAssigneeEmail.split(",").map(e => e.trim());
                return emails.includes(userData.email);
            });
            console.log(`DEBUG: Scorecard - User has ${userTasks.length} total assigned tasks.`);
            const totalAssigned = userTasks.length;
            const completedCount = userTasks.filter(t => t.status === "completed").length;
            const overdueCount = userTasks.filter(t => t.status === "pending" && t.targetWeek < currentWeek).length;

            // Calculate late completions
            let lateCount = 0;
            userTasks.forEach(t => {
                if (t.status === "completed" && isTaskLate(t, projectStartDate)) {
                    lateCount++;
                }
            });

            // Score: (Completed - Total) * 10
            const score = (completedCount - totalAssigned) * 10;

            // Update Scorecard UI
            scoreTotalEl.textContent = totalAssigned;
            scoreCompletedEl.textContent = completedCount;
            scoreOverdueEl.textContent = overdueCount;
            scoreLateEl.textContent = lateCount;
            scoreFinalEl.textContent = score;

            // If not team feed and not assign mode, filter to only this user's tasks
            if (!showTeamFeed && !assignMode) {
                visibleTasks = visibleTasks.filter(task => {
                    if (!task.actualAssigneeEmail) return false;
                    const emails = task.actualAssigneeEmail.split(",").map(e => e.trim());
                    return emails.includes(userData.email);
                });
            }

            renderTasks(visibleTasks, currentWeek);
        };

        // Build the query based on user role and state
        let tasksQuery = supabaseClient.from('tasks').select('*').eq('project_id', projectId);

        if (isRM) {
            // RM/Admin logic
            if (showNextWeekBtn) {
                showNextWeekBtn.classList.remove("hidden");
                showNextWeekBtn.textContent = showNextWeekTasks ? "Hide Next Week Tasks" : "Show Next Week Tasks";
            }

            if (!showNextWeekTasks) {
                tasksQuery = tasksQuery.lte('targetWeek', currentWeek + 1);
            }
        } else {
            // Standard Employee Logic
            if (showNextWeekBtn) {
                showNextWeekBtn.classList.add("hidden");
            }
            // Add client side filtering for assigned later so we have all data for scorecard if requested.
            // But if we want to optimize, we can filter here, but we need all user tasks for scorecard anyway.
        }

        // 1. Initial Fetch
        tasksQuery.then(({ data: initialTasks, error }) => {
            if (error) {
                console.error("Error fetching initial tasks:", error);
                return;
            }

            let allTasks = initialTasks || [];

            // Further filter initial load if not RM (only assigned tasks for employee)
            if (!isRM) {
                allTasks = allTasks.filter(taskData => {
                    if (!taskData.actualAssigneeEmail) return false;
                    const assignedEmails = taskData.actualAssigneeEmail.split(",").map(e => e.trim());
                    return assignedEmails.includes(userData.email);
                });
            }

            processAndRenderTasks(allTasks);

            // 2. Subscribe to realtime changes for this project
            unsubscribeTasks = supabaseClient
                .channel(`tasks-channel-${projectId}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
                    (payload) => {
                        console.log('Realtime task change received!', payload);

                        // Handle insert, update, delete
                        if (payload.eventType === 'INSERT') {
                            const newTask = payload.new;
                            if (!isRM && newTask.actualAssigneeEmail && !newTask.actualAssigneeEmail.split(",").map(e => e.trim()).includes(userData.email)) {
                                return; // Ignore if not assigned to employee
                            }
                            allTasks.push(payload.new);
                        } else if (payload.eventType === 'UPDATE') {
                            const updatedTask = payload.new;
                            // Check if employee was removed or added
                            const isAssigned = updatedTask.actualAssigneeEmail && updatedTask.actualAssigneeEmail.split(",").map(e => e.trim()).includes(userData.email);

                            const index = allTasks.findIndex(t => t.id === updatedTask.id);
                            if (index !== -1) {
                                if (!isRM && !isAssigned) {
                                    // Removed from task
                                    allTasks.splice(index, 1);
                                } else {
                                    allTasks[index] = updatedTask;
                                }
                            } else if (!isRM && isAssigned) {
                                // Added to task
                                allTasks.push(updatedTask);
                            } else if (isRM) {
                                allTasks.push(updatedTask);
                            }
                        } else if (payload.eventType === 'DELETE') {
                            allTasks = allTasks.filter(t => t.id !== payload.old.id);
                        }

                        processAndRenderTasks(allTasks);
                    }
                )
                .subscribe();
        });

    });
}

// Assign Tasks button toggle
assignTasksBtn.addEventListener("click", () => {
    assignMode = !assignMode;
    assignTasksBtn.textContent = assignMode ? "✓ Done Assigning" : "Assign Tasks";
    assignTasksBtn.style.backgroundColor = assignMode ? "#e67e22" : "";
    // Reload tasks to refresh the UI
    if (activeProjectSelect.value) {
        loadProjectTasks(activeProjectSelect.value);
    }
});

toggleCompletedBtn.addEventListener("click", () => {
    showCompletedTasks = !showCompletedTasks;
    toggleCompletedBtn.textContent = showCompletedTasks ? "Hide Completed Tasks" : "Show Completed Tasks";
    if (showCompletedTasks) {
        completedTasksList.classList.remove("hidden");
    } else {
        completedTasksList.classList.add("hidden");
    }
    // Re-render tasks if already loaded
    if (activeProjectSelect.value) loadProjectTasks(activeProjectSelect.value);
});

teamFeedToggle.addEventListener("change", () => {
    if (activeProjectSelect.value) {
        loadProjectTasks(activeProjectSelect.value);
    }
});

if (showNextWeekBtn) {
    showNextWeekBtn.addEventListener("click", () => {
        showNextWeekTasks = !showNextWeekTasks;
        showNextWeekBtn.textContent = showNextWeekTasks ? "Hide Next Week Tasks" : "Show Next Week Tasks";

        if (showNextWeekTasks) {
            nextWeekTasksList.classList.remove("hidden");
        } else {
            nextWeekTasksList.classList.add("hidden");
        }

        if (activeProjectSelect.value) loadProjectTasks(activeProjectSelect.value);
    });
}

function renderTasks(tasks, currentWeek) {
    actionRequiredList.innerHTML = "";
    thisWeekList.innerHTML = "";
    completedTasksList.innerHTML = "";
    if (nextWeekTasksList) nextWeekTasksList.innerHTML = "";

    tasks.forEach(task => {
        const card = createTaskCard(task);

        let isActionRequired = false;
        // In-progress tasks that haven't been completed OR On Hold
        if ((task.status === "in_progress" || task.status === "on_hold") && !task.endTime) {
            isActionRequired = true;
        } else if (task.status === "pending" && task.targetWeek < currentWeek) {
            isActionRequired = true;
        } else if (task.status === "awaiting_approval") {
            const isAdmin = userData.role === "admin" || userData.role === "master_admin";
            if (isAdmin) {
                isActionRequired = true; // Needs admin approval
            } else if (task.targetWeek < currentWeek) {
                isActionRequired = true; // Still late and waiting
            }
        }

        if (task.status === "completed") {
            if (showCompletedTasks) {
                completedTasksList.appendChild(card);
            }
        } else if (isActionRequired) {
            card.classList.add("priority");
            actionRequiredList.appendChild(card);
        } else if (task.targetWeek > currentWeek) {
            // It's a next week task
            if (showNextWeekTasks) {
                nextWeekTasksList.appendChild(card);
            }
        } else {
            thisWeekList.appendChild(card);
        }
    });

    // Show empty state messages
    if (!actionRequiredList.children.length) {
        actionRequiredList.innerHTML = '<p style="color:#888; padding:10px;">No action required ✓</p>';
    }
    if (!thisWeekList.children.length) {
        thisWeekList.innerHTML = `<p style="color:#888; padding:10px;">No tasks for Week ${currentWeek}</p>`;
    }
    if (showCompletedTasks && !completedTasksList.children.length) {
        completedTasksList.innerHTML = '<p style="color:#888; padding:10px;">No completed tasks found.</p>';
    }
    if (showNextWeekTasks && nextWeekTasksList && !nextWeekTasksList.children.length) {
        nextWeekTasksList.innerHTML = '<p style="color:#888; padding:10px;">No tasks found for next week.</p>';
    }
}

function calculateCurrentWeek(projectStartDate) {
    if (!projectStartDate) return 1;
    const now = new Date();
    const diffMs = now - projectStartDate;
    if (diffMs < 0) return 1; // Project hasn't started yet
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
}

/**
 * Check if a completed task was finished after its target week
 */
function isTaskLate(task, projectStartDate) {
    if (!task.endTime || !projectStartDate) return false;

    // Task deadline: End of Target Week
    // Target Week 1 ends on Day 7 (index 0-6 is week 1, so week 1 ends start + 7 days)
    const deadlineDays = task.targetWeek * 7;
    const deadlineMs = deadlineDays * 24 * 60 * 60 * 1000;
    const deadlineDate = new Date(projectStartDate.getTime() + deadlineMs);

    // Compare actual end time with deadline
    // Allow end of day buffer? Firestore timestamp to Date
    let endDate;
    if (task.endTime.toDate) endDate = task.endTime.toDate();
    else endDate = new Date(task.endTime);

    return endDate > deadlineDate;
}

function createTaskCard(task) {
    const div = document.createElement("div");
    div.className = "task-card";
    if (task.status === "completed") div.classList.add("completed");

    // Handle multi-assignee display
    const emailsRaw = (task.actualAssigneeEmail || "Unassigned").split(",").map(e => e.trim()).filter(e => e !== "");
    const finalEmails = emailsRaw.length > 0 ? emailsRaw : ["Unassigned"];

    const assigneeDisplays = finalEmails.map(email => {
        const member = projectTeamCache.find(m => m.email === email);
        return member ? `${member.role} - ${member.name}` : email;
    });
    const assigneeDisplay = assigneeDisplays.join(", ");

    // Status Display Text
    const statusText = task.status.replace("_", " ").toUpperCase();

    // Formatting Phase/Week compact
    // Example: Phase-1 | W1
    const metaText = `${task.phase} | W${task.targetWeek}`;

    const hasRemarks = task.remarks && task.remarks.length > 0;
    const remarkDotClass = hasRemarks ? "remark-btn has-remarks" : "remark-btn";

    div.innerHTML = `
        <div class="task-header-compact">
            <h4 class="task-title" title="${task.taskName}">${task.taskName}</h4>
            <span class="task-meta">${metaText}</span>
        </div>
        
        <div class="task-controls-row">
            <div class="assignee-status-group">
                <div class="assignee-info">
                    ${assigneeDisplay}
                </div>
                <div class="status-label ${task.status}">${statusText}</div>
            </div>

            <button class="${remarkDotClass}" title="Remarks${hasRemarks ? ` (${task.remarks.length})` : ''}" data-task-id="${task.id}">💬</button>
            
            <div class="task-actions">
                ${getActionButton(task)}
            </div>
        </div>
    `;

    // Wire remark icon → open remarks modal
    const remarkBtn = div.querySelector(".remark-btn");
    if (remarkBtn) {
        remarkBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openRemarksModal(task);
        });
    }

    // Handle assign mode dropdown
    const assignSelect = div.querySelector(".assign-dropdown");
    if (assignSelect) {
        assignSelect.addEventListener("change", async (e) => {
            const selectedEmail = e.target.value;
            if (!selectedEmail) return;
            try {
                const member = projectTeamCache.find(m => m.email === selectedEmail);
                const { error } = await supabaseClient
                    .from('tasks')
                    .update({
                        actualAssigneeEmail: selectedEmail,
                        assigneeRole: member ? member.role : ""
                    })
                    .eq('id', task.id);

                if (error) throw error;
                console.log(`Assigned task ${task.id} to ${selectedEmail}`);
            } catch (err) {
                console.error("Error assigning task:", err);
                alert("Failed to assign task.");
            }
        });
    }

    // Handle requirement dropdown (RM/Admin only)
    const requirementSelect = div.querySelector(".requirement-select");
    if (requirementSelect) {
        requirementSelect.addEventListener("change", async (e) => {
            const value = e.target.value;
            if (!value) return;

            if (value === "not_applicable") {
                const taskName = task.Task_Name || task.taskName || "this task";
                let projectName = task.projectId || task.project_id || "this project";

                // Retrieve the active project name from the UI dropdown
                const activeProjOpt = document.querySelector(`#active-project option[value="${task.projectId || task.project_id}"]`);
                if (activeProjOpt && activeProjOpt.textContent) {
                    // textContent includes "ProjectName (PRJ-X)"
                    projectName = activeProjOpt.textContent;
                }

                // Exact prompt string requested by user
                const confirmed = confirm(`Are you sure task "${taskName}" is not applicable for project "${projectName}"?`);
                if (!confirmed) {
                    e.target.value = ""; // Reset dropdown to placeholder
                    return;
                }
            }

            await setRequirement(task, value);
        });
    }

    // Handle normal Start/Complete/On Hold button
    // Admin/Master Admin cannot change status!
    const btnContainer = div.querySelector(".task-actions");
    if (btnContainer) {
        btnContainer.addEventListener("click", (e) => {
            if (e.target.tagName === "BUTTON") {
                const action = e.target.dataset.action;
                if (action) handleTaskAction(task, action);
            }
        });
    }

    return div;
}

function getActionButton(task) {
    // In assign mode, show team dropdown
    // Admin CAN assign tasks
    if (assignMode && task.status === "pending") {
        let options = '<option value="">-- Assign to --</option>';
        projectTeamCache.forEach(m => {
            const selected = m.email === task.actualAssigneeEmail ? "selected" : "";
            options += `<option value="${m.email}" ${selected}>${m.role} - ${m.name}</option>`;
        });
        return `<select class="assign-dropdown">${options}</select>`;
    }

    // RM / Master Admin: show requirement dropdown if requirement not yet set
    const isRMOrAdmin = userData.role === "RM" || userData.role === "master_admin";
    const requirementNotSet = task.requirement === "" || task.requirement === undefined || task.requirement === null;
    if (isRMOrAdmin && requirementNotSet) {
        return `<select class="requirement-select" data-task-id="${task.id}">
            <option value="">-- Set Requirement --</option>
            <option value="applicable">Applicable</option>
            <option value="not_applicable">Not Applicable</option>
            <option value="already_completed">Already Completed</option>
        </select>`;
    }

    // Admin/Master Admin sees NO status buttons (only the requirement dropdown above if needed)
    if (userData.role === "admin" || userData.role === "master_admin") {
        if (task.status === "awaiting_approval") {
            return `<button class="btn-approve" data-action="approve">Approve</button>`;
        }
        return "";
    }

    if (task.status === "pending") {
        return `<button class="btn-start" data-action="start">Start</button>`;
    } else if (task.status === "in_progress") {
        return `
            <button class="btn-complete" data-action="complete">Complete</button>
            <button class="btn-hold" data-action="hold">Hold</button>
        `;
    } else if (task.status === "on_hold") {
        return `<button class="btn-resume" data-action="resume">Resume</button>`;
    } else {
        // Completed -> No buttons, just status text (which is handled by status-label)
        return "";
    }
}

async function handleTaskAction(task, action) {
    try {
        let updateData = {};
        if (action === "start") {
            updateData = {
                status: "in_progress",
                startTime: new Date().toISOString()
            };
        } else if (action === "complete") {
            updateData = {
                status: "awaiting_approval",
                endTime: new Date().toISOString()
            };
        } else if (action === "approve") {
            updateData = {
                status: "completed"
            };
        } else if (action === "hold") {
            updateData = {
                status: "on_hold"
            };
        } else if (action === "resume") {
            updateData = {
                status: "in_progress"
            };
        }

        const { error } = await supabaseClient.from('tasks').update(updateData).eq('id', task.id);
        if (error) throw error;
    } catch (e) {
        console.error("Error updating task:", e);
        alert("Failed to update task.");
    }
}

// RM Modal Logic
function setupTeamManagement(projectId) {
    // Helper to clear form or prepare it
    // Actual logic is in click handler
}

manageTeamBtn.addEventListener("click", async () => {
    if (!activeProjectSelect.value) return alert("Select a project first.");

    manageTeamModal.classList.remove("hidden");
    const projId = activeProjectSelect.value;

    try {
        const { data: pData, error } = await supabaseClient.from('projects').select('*').eq('id', projId).single();
        if (error) throw error;

        // All 5 roles with display names matching Add Project modal
        const roles = [
            { key: "RM", label: "Project RM" },
            { key: "FDD", label: "Financial Due Diligence" },
            { key: "Sec", label: "Secretarial" },
            { key: "PC", label: "Project Coordinator" },
            { key: "AM", label: "Assistant Manager" }
        ];

        teamMappingForm.innerHTML = "";

        // Fetch users for dropdowns
        await fetchAllUsers();

        roles.forEach(({ key, label }) => {
            const currentEmailStr = pData[`Project_${key}`] || "";
            const currentEmails = currentEmailStr.split(",").map(e => e.trim()).filter(e => e !== "");

            const div = document.createElement("div");
            div.className = "team-role-input form-field";

            if (key === "RM") {
                // RM remains a single select
                const matches = allUsersCache.filter(u => u.role && u.role.toLowerCase() === key.toLowerCase());
                let optionsHtml = `<option value="">-- Select ${label} --</option>`;
                matches.forEach(u => {
                    const selected = u.email === currentEmailStr ? "selected" : "";
                    optionsHtml += `<option value="${u.email}" ${selected}>${u.name} (${u.email})</option>`;
                });
                if (currentEmailStr && !matches.find(u => u.email === currentEmailStr)) {
                    optionsHtml += `<option value="${currentEmailStr}" selected>${currentEmailStr}</option>`;
                }
                div.innerHTML = `<label>${label}:</label><select data-role="${key}">${optionsHtml}</select>`;
            } else {
                // Multi-select for others
                const dropdownId = `manage-${key.toLowerCase()}-dropdown`;
                const textId = `manage-${key.toLowerCase()}-text`;
                div.innerHTML = `
                    <label>${label}:</label>
                    <div class="multi-select-container" data-role="${key}" id="manage-${key.toLowerCase()}-container">
                        <div class="multi-select-header">
                            <span class="multi-select-text" id="${textId}">-- Select ${label} --</span>
                            <span class="multi-select-icon">&#9662;</span>
                        </div>
                        <div class="multi-select-dropdown hidden" id="${dropdownId}">
                            <!-- Checkboxes injected here -->
                        </div>
                    </div>
                `;
            }
            teamMappingForm.appendChild(div);
        });

        // Populate the injected multi-selects and attach events
        setTimeout(() => {
            roles.forEach(({ key, label }) => {
                if (key !== "RM") {
                    const dropdownId = `manage-${key.toLowerCase()}-dropdown`;
                    const textId = `manage-${key.toLowerCase()}-text`;

                    populateMultiSelectDropdown(dropdownId, key, textId);

                    // Pre-check existing values
                    const currentEmailStr = pData[`Project_${key}`] || "";
                    if (currentEmailStr) {
                        const currentEmails = currentEmailStr.split(",").map(e => e.trim());
                        const dropdown = document.getElementById(dropdownId);
                        if (dropdown) {
                            currentEmails.forEach(email => {
                                const cb = dropdown.querySelector(`input[type="checkbox"][value="${email}"]`);
                                if (cb) cb.checked = true;
                            });
                            updateMultiSelectText(dropdownId, textId, key);
                        }
                    }

                    // Attach toggle listener to the newly injected header
                    const container = document.getElementById(`manage-${key.toLowerCase()}-container`);
                    if (container) {
                        const header = container.querySelector(".multi-select-header");
                        header.addEventListener("click", () => {
                            const dropdown = document.getElementById(dropdownId);
                            if (dropdown) dropdown.classList.toggle("hidden");
                        });
                    }
                }
            });
        }, 0);

    } catch (e) {
        console.error("Error fetching project for team manage:", e);
    }
});

closeModalSpan.addEventListener("click", () => {
    manageTeamModal.classList.add("hidden");
});

saveTeamBtn.addEventListener("click", async () => {
    const projId = activeProjectSelect.value;
    const newTeamMap = {};

    // RM
    const rmSelect = teamMappingForm.querySelector("select[data-role='RM']");
    if (rmSelect) newTeamMap["RM"] = rmSelect.value;

    // Others (FDD, Sec, PC, AM)
    ["FDD", "Sec", "PC", "AM"].forEach(roleKey => {
        newTeamMap[roleKey] = getMultiSelectValues(`manage-${roleKey.toLowerCase()}-dropdown`);
    });

    try {
        // --- Fetch current project to find differences in team ---
        const { data: existingData, error: fetchError } = await supabaseClient.from('projects').select('*').eq('id', projId).single();
        if (fetchError) throw fetchError;

        const oldEmailsString = [
            existingData.Project_RM,
            existingData.Project_FDD,
            existingData.Project_Sec,
            existingData.Project_PC,
            existingData.Project_AM
        ].filter(e => e && e.trim() !== "").join(",");
        const oldTeamEmails = [...new Set(oldEmailsString.split(",").map(e => e.trim()).filter(e => e !== ""))];

        const newEmailsString = [
            newTeamMap["RM"],
            newTeamMap["FDD"],
            newTeamMap["Sec"],
            newTeamMap["PC"],
            newTeamMap["AM"]
        ].filter(e => e && e.trim() !== "").join(",");
        const newTeamEmails = [...new Set(newEmailsString.split(",").map(e => e.trim()).filter(e => e !== ""))];

        const addedEmails = newTeamEmails.filter(email => !oldTeamEmails.includes(email));
        const removedEmails = oldTeamEmails.filter(email => !newTeamEmails.includes(email));
        // --------------------------------------------------------

        const { error: updateError } = await supabaseClient.from('projects').update({
            Project_RM: newTeamMap["RM"] || "",
            Project_FDD: newTeamMap["FDD"] || "",
            Project_Sec: newTeamMap["Sec"] || "",
            Project_PC: newTeamMap["PC"] || "",
            Project_AM: newTeamMap["AM"] || ""
        }).eq('id', projId);

        if (updateError) throw updateError;

        if (updateError) throw updateError;

        // User assigned_projects array sync removed (anti-pattern)
        // Access is now parsed dynamically via project columns on login

        await updateProjectTasksAssignees(projId, newTeamMap);
        manageTeamModal.classList.add("hidden");
        alert("Team updated!");
    } catch (e) {
        console.error("Error saving team:", e);
        alert("Failed to save team.");
    }
});

async function updateProjectTasksAssignees(projectId, teamMap) {
    try {
        const { data: tasks, error } = await supabaseClient.from('tasks').select('*').eq('project_id', projectId);
        if (error) throw error;

        for (const task of tasks) {
            if (task.assigneeRole && teamMap[task.assigneeRole]) {
                const newEmail = teamMap[task.assigneeRole];
                if (task.actualAssigneeEmail !== newEmail) {
                    await supabaseClient.from('tasks').update({ actualAssigneeEmail: newEmail }).eq('id', task.id);
                }
            }
        }
    } catch (e) {
        console.error("Error updating task assignees:", e);
    }
}

// ==========================================
// Add User Modal Logic (Master Admin only)
// ==========================================

addUserBtn.addEventListener("click", () => {
    // Clear form
    newUserName.value = "";
    newUserEmail.value = "";
    newUserRole.value = "employee";
    newUserProject.value = "";
    addUserModal.classList.remove("hidden");
});

closeAddUserModal.addEventListener("click", () => {
    addUserModal.classList.add("hidden");
});

saveUserBtn.addEventListener("click", async () => {
    const name = newUserName.value.trim();
    const email = newUserEmail.value.trim();
    const role = newUserRole.value;
    const assignedProject = newUserProject.value.trim();

    if (!name || !email) {
        alert("Name and Email are required.");
        return;
    }

    try {
        const { data: existingUser } = await supabaseClient.from('users').select('*').eq('email', email).single();

        if (existingUser) {
            if (!confirm(`User "${email}" already exists. Overwrite?`)) {
                return;
            }

            const { error: updateError } = await supabaseClient.from('users').update({
                name: name,
                role: role,
                updated_at: new Date().toISOString()
            }).eq('email', email);

            if (updateError) throw updateError;
        } else {
            const newUserData = {
                name: name,
                email: email,
                role: role
            };

            const { error: insertError } = await supabaseClient.from('users').insert(newUserData);
            if (insertError) throw insertError;
        }

        alert(`User "${name}" (${email}) added/updated successfully!`);
        addUserModal.classList.add("hidden");
        // Force refresh cache
        allUsersCache = [];
    } catch (e) {
        console.error("Error adding user:", e);
        alert("Failed to add user: " + e.message);
    }
});

// ==========================================
// Add Project Modal Logic (Master Admin only)
// ==========================================

// Cache for users 
let allUsersCache = [];

/**
 * Generate next Project ID in pattern PR001, PR002, ...
 */
async function generateNextProjectId() {
    try {
        const { data: projects, error } = await supabaseClient.from('projects').select('id');
        if (error) throw error;

        if (!projects || projects.length === 0) return "PR001";

        let maxNum = 0;
        projects.forEach(p => {
            const id = p.id; // e.g., "PR004"
            if (id.startsWith("PR")) {
                const numStr = id.substring(2);
                const num = parseInt(numStr, 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });

        const nextNum = maxNum + 1;
        return "PR" + String(nextNum).padStart(3, "0");
    } catch (e) {
        console.error("Error generating project ID:", e);
        return "PR001";
    }
}

/**
 * Fetch all users and cache them
 */
async function fetchAllUsers() {
    if (allUsersCache.length > 0) return allUsersCache;
    try {
        const { data: users, error } = await supabaseClient.from('users').select('*');
        if (error) throw error;

        allUsersCache = users || [];
        return allUsersCache;
    } catch (e) {
        console.error("Error fetching users:", e);
        return [];
    }
}

/**
 * Populate a <select> dropdown with users of a specific role
 */
function populateRoleDropdown(selectId, role) {
    const select = document.getElementById(selectId);
    // Clear existing options
    select.innerHTML = `<option value="">-- Select ${role} --</option>`;

    const matches = allUsersCache.filter(u =>
        u.role && u.role.toLowerCase() === role.toLowerCase()
    );

    matches.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.email;
        opt.textContent = `${u.name} (${u.email})`;
        select.appendChild(opt);
    });
}

/**
 * Populate a custom multi-select dropdown with users of a specific role
 */
function populateMultiSelectDropdown(dropdownId, role, textId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    dropdown.innerHTML = ""; // Clear existing options

    const matches = allUsersCache.filter(u =>
        u.role && u.role.toLowerCase() === role.toLowerCase()
    );

    matches.forEach(u => {
        const opt = document.createElement("div");
        opt.className = "multi-select-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = u.email;
        checkbox.id = `${dropdownId}-opt-${u.email.replace(/[@.]/g, '-')}`;

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.textContent = `${u.name} (${u.email})`;
        label.style.cursor = "pointer";
        label.style.flexGrow = "1";
        label.style.margin = "0";

        // Update text when selection changes
        checkbox.addEventListener("change", () => updateMultiSelectText(dropdownId, textId, role));

        opt.appendChild(checkbox);
        opt.appendChild(label);
        dropdown.appendChild(opt);
    });

    // Reset text
    updateMultiSelectText(dropdownId, textId, role);
}

function updateMultiSelectText(dropdownId, textId, role) {
    const dropdown = document.getElementById(dropdownId);
    const textSpan = document.getElementById(textId);
    if (!dropdown || !textSpan) return;

    const checked = dropdown.querySelectorAll("input[type='checkbox']:checked");

    if (checked.length === 0) {
        textSpan.textContent = `-- Select ${role} --`;
    } else {
        const names = Array.from(checked).map(cb => {
            const label = cb.nextSibling;
            const fullText = label.textContent;
            return fullText.split(" (")[0];
        });
        textSpan.textContent = names.join(", ");
    }
}

// Event listeners for multi-select dropdown toggling (Required due to Manifest V3 CSP blocking inline onclick)
document.querySelectorAll(".multi-select-header").forEach(header => {
    header.addEventListener("click", (e) => {
        const container = e.currentTarget.closest(".multi-select-container");
        const dropdown = container.querySelector(".multi-select-dropdown");
        if (dropdown) {
            dropdown.classList.toggle("hidden");
        }
    });
});

function getMultiSelectValues(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return "";
    const checked = dropdown.querySelectorAll("input[type='checkbox']:checked");
    return Array.from(checked).map(cb => cb.value).join(",");
}

// Close multi-selects when clicking outside
document.addEventListener("click", (e) => {
    const isMultiSelectClick = e.target.closest(".multi-select-container");
    if (!isMultiSelectClick) {
        document.querySelectorAll(".multi-select-dropdown").forEach(dropdown => {
            dropdown.classList.add("hidden");
        });
    }
});

/**
 * Set up autocomplete on an input field using the users cache
 */
function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const sugList = document.getElementById(suggestionsId);

    input.addEventListener("input", () => {
        const query = input.value.trim().toLowerCase();
        sugList.innerHTML = "";

        if (query.length < 3) {
            sugList.classList.remove("active");
            return;
        }

        const matches = allUsersCache.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
            sugList.classList.remove("active");
            return;
        }

        matches.forEach(u => {
            const item = document.createElement("div");
            item.className = "autocomplete-item";
            item.innerHTML = `<span class="item-name">${u.name}</span><br><span class="item-email">${u.email}</span>`;
            item.addEventListener("click", () => {
                input.value = u.email;
                sugList.innerHTML = "";
                sugList.classList.remove("active");
            });
            sugList.appendChild(item);
        });

        sugList.classList.add("active");
    });

    // Close suggestions when clicking outside
    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !sugList.contains(e.target)) {
            sugList.classList.remove("active");
        }
    });
}

addProjectBtn.addEventListener("click", async () => {
    // Auto-generate Project ID
    const nextId = await generateNextProjectId();
    document.getElementById("proj-id").value = nextId;

    // Reset other fields
    document.getElementById("proj-name").value = "";
    document.getElementById("proj-start-date").value = "";
    document.getElementById("proj-status").value = "active";
    document.getElementById("proj-add1").value = "";
    document.getElementById("proj-add2").value = "";
    document.getElementById("proj-add3").value = "";

    // Fetch users and populate role dropdowns
    await fetchAllUsers();
    populateRoleDropdown("proj-rm", "RM");
    populateMultiSelectDropdown("proj-fdd-dropdown", "FDD", "proj-fdd-text");
    populateMultiSelectDropdown("proj-sec-dropdown", "Sec", "proj-sec-text");
    populateMultiSelectDropdown("proj-pc-dropdown", "PC", "proj-pc-text");
    populateMultiSelectDropdown("proj-am-dropdown", "AM", "proj-am-text");

    // Set up autocomplete for additional members
    setupAutocomplete("proj-add1", "proj-add1-suggestions");
    setupAutocomplete("proj-add2", "proj-add2-suggestions");
    setupAutocomplete("proj-add3", "proj-add3-suggestions");

    addProjectModal.classList.remove("hidden");
});

closeAddProjectModal.addEventListener("click", () => {
    addProjectModal.classList.add("hidden");
});

saveProjectBtn.addEventListener("click", async () => {
    const projectId = document.getElementById("proj-id").value.trim();
    const projectName = document.getElementById("proj-name").value.trim();
    const startDate = document.getElementById("proj-start-date").value;
    const projectStatus = document.getElementById("proj-status").value;

    if (!projectId || !projectName || !startDate) {
        alert("Project Name and Start Date are required.");
        return;
    }

    // Disable button to prevent double clicks
    saveProjectBtn.disabled = true;
    saveProjectBtn.textContent = "Creating...";

    try {
        // Step 1: Check if project exists
        const { data: existingProj } = await supabaseClient.from('projects').select('id').eq('id', projectId).single();

        if (existingProj) {
            if (!confirm(`Project "${projectId}" already exists. Overwrite?`)) {
                saveProjectBtn.disabled = false;
                saveProjectBtn.textContent = "Create Project";
                return;
            }
        }

        // Step 2: Save project document
        const projectData = {
            id: projectId,
            Project_Name: projectName,
            Start_Date: startDate ? new Date(startDate + "T00:00:00").toISOString() : null,
            Project_Status: projectStatus,
            Project_RM: document.getElementById("proj-rm").value,
            Project_FDD: getMultiSelectValues("proj-fdd-dropdown"),
            Project_Sec: getMultiSelectValues("proj-sec-dropdown"),
            Project_PC: getMultiSelectValues("proj-pc-dropdown"),
            Project_AM: getMultiSelectValues("proj-am-dropdown"),
            Project_Additional_mem_1: document.getElementById("proj-add1").value.trim(),
            Project_Additional_mem_2: document.getElementById("proj-add2").value.trim(),
            Project_Additional_mem_3: document.getElementById("proj-add3").value.trim(),
            created_at: new Date().toISOString(),
            createdBy: currentUser.email
        };

        const { error: projectError } = await supabaseClient.from('projects').upsert(projectData);
        if (projectError) throw projectError;

        console.log("Step 2 done: Project document saved.");

        // Step 2.5 removed: Users are no longer assigned via anti-pattern array.
        // Dashboard now queries the projects table directly to dynamically find assignments.

        // Step 3: Read master_template (assuming a master_template table exists now)
        console.log("Step 3: Reading master_template...");
        const { data: masterDocs, error: masterError } = await supabaseClient.from('master_template').select('*');

        if (masterError) throw masterError;
        console.log(`Step 3 done: Found ${masterDocs ? masterDocs.length : 0} master template docs.`);

        if (!masterDocs || masterDocs.length === 0) {
            alert("Project created, but master_template table is empty! No tracker tasks to copy.");
            saveProjectBtn.disabled = false;
            saveProjectBtn.textContent = "Create Project";
            addProjectModal.classList.add("hidden");
            loadProjects([]);
            return;
        }

        // Step 4: Write all docs to tasks table
        console.log(`Step 4: Writing ${masterDocs.length} docs to tasks table...`);
        saveProjectBtn.textContent = `Copying ${masterDocs.length} tasks...`;

        const newTasks = [];

        masterDocs.forEach(templateData => {
            // Calculate Deadline based on Week
            let deadlineDate = null;
            const weekNum = templateData.targetWeek;

            if (startDate && typeof weekNum === "number" && weekNum > 0) {
                const sDate = new Date(startDate + "T00:00:00");
                const daysToAdd = (weekNum * 7) - 1;
                sDate.setDate(sDate.getDate() + daysToAdd);
                sDate.setHours(23, 59, 59, 999);
                deadlineDate = sDate.toISOString();
            }

            newTasks.push({
                project_id: projectId,
                taskName: templateData.taskName,
                phase: templateData.phase,
                targetWeek: templateData.targetWeek,
                assigneeRole: templateData.assigneeRole,
                status: "pending",
                startTime: null,
                endTime: null,
                deadline: deadlineDate,
                remarks: [],
                requirement: "",
                actualAssigneeEmail: templateData.assigneeRole
                    ? (projectData[`Project_${templateData.assigneeRole}`] || "")
                    : "",
                created_at: new Date().toISOString()
            });
        });

        // Insert in bulk
        const { error: insertError } = await supabaseClient.from('tasks').insert(newTasks);
        if (insertError) throw insertError;

        console.log(`Step 4 done: ${newTasks.length} docs written to tasks table.`);

        alert(`✅ Project "${projectName}" (${projectId}) created!\n✅ Created with ${newTasks.length} tasks.`);
        addProjectModal.classList.add("hidden");

        // Invalidate user cache
        allUsersCache = [];

        // Refresh project dropdown
        loadProjects([]);
    } catch (e) {
        console.error("Error in project creation:", e);
        alert("❌ Error: " + e.message);
    } finally {
        saveProjectBtn.disabled = false;
        saveProjectBtn.textContent = "Create Project";
    }
});

/* =========================================
   ADMIN DASHBOARD LOGIC
   ========================================= */

const dashboardToggle = document.getElementById("dashboard-toggle");
const dashboardView = document.getElementById("dashboard-view");
const reportTypeSelect = document.getElementById("report-type-select");
const dashboardContent = document.getElementById("dashboard-content");

// Sections to hide when Dashboard is active
const actionSection = document.getElementById("action-required-section");
const weekSection = document.getElementById("this-week-section");
const completedSection = document.querySelector(".completed-tasks-container");

const sidebarMainContent = document.getElementById("sidebar-main-content");
const dashboardProjectSelect = document.getElementById("dashboard-project-select");
const sidebarProjectSelectorDiv = document.querySelector(".sidebar .project-selector");

function updateDashboardControls() {
    const isDashboard = dashboardToggle.checked;
    const reportType = reportTypeSelect ? reportTypeSelect.value : "project";

    // 1. Sidebar Project Selector Visibility
    // Hide the sidebar's project selector when in Dashboard mode (to avoid confusion/duplication)
    // But keep the rest of the sidebar visible.
    if (sidebarProjectSelectorDiv) {
        if (isDashboard) sidebarProjectSelectorDiv.classList.add("hidden");
        else sidebarProjectSelectorDiv.classList.remove("hidden");
    }

    // Ensure main content is NOT hidden (reverting previous logic)
    if (sidebarMainContent) {
        sidebarMainContent.classList.remove("hidden");
    }

    // 2. Dashboard Project Selector Visibility (Always visible in DOM for layout, toggle visibility)
    if (dashboardProjectSelect) {
        // Remove 'hidden' class so it takes up space (flex layout)
        dashboardProjectSelect.classList.remove("hidden");

        if (isDashboard && reportType === "project") {
            dashboardProjectSelect.style.visibility = "visible";
        } else {
            dashboardProjectSelect.style.visibility = "hidden";
        }
    }
}

if (dashboardToggle) {
    dashboardToggle.addEventListener("change", (e) => {
        const isDashboard = e.target.checked;

        updateDashboardControls();

        if (isDashboard) {
            // Show Dashboard, Hide Tasks & Manage Projects
            dashboardView.classList.remove("hidden");
            if (manageProjectsView) manageProjectsView.classList.add("hidden");
            if (actionSection) actionSection.classList.add("hidden");
            if (weekSection) weekSection.classList.add("hidden");
            if (completedSection) completedSection.classList.add("hidden");

            // Initial Load Logic
            const reportType = reportTypeSelect ? reportTypeSelect.value : "project";
            if (reportType === "employee") {
                loadAggregateEmployeeData();
            } else {
                // Ensure we have correct single-project data (re-subscribe if needed)
                const pid = activeProjectSelect ? activeProjectSelect.value : null;
                if (pid) loadProjectTasks(pid);
                else renderDashboard();
            }
        } else {
            // Show Tasks, Hide Dashboard & Manage Projects
            dashboardView.classList.add("hidden");
            if (manageProjectsView) manageProjectsView.classList.add("hidden");
            if (actionSection) actionSection.classList.remove("hidden");
            if (weekSection) weekSection.classList.remove("hidden");
            if (completedSection) completedSection.classList.remove("hidden");
        }
    });
}

if (reportTypeSelect) {
    reportTypeSelect.addEventListener("change", () => {
        updateDashboardControls();
        const reportType = reportTypeSelect.value;
        if (reportType === "employee") {
            loadAggregateEmployeeData();
        } else {
            // Switch back to single project
            const projectId = activeProjectSelect.value;
            if (projectId) {
                loadProjectTasks(projectId);
            } else {
                renderDashboard();
            }
        }
    });
}

async function loadAggregateEmployeeData() {
    if (unsubscribeTasks) unsubscribeTasks();

    // Show loading state
    dashboardContent.innerHTML = '<div style="padding:20px; text-align:center;">Loading aggregate data from all projects...</div>';

    // 1. Get all project IDs from the dropdown
    const projectIds = [];
    if (activeProjectSelect) {
        for (let i = 0; i < activeProjectSelect.options.length; i++) {
            const val = activeProjectSelect.options[i].value;
            if (val && !activeProjectSelect.options[i].disabled) {
                projectIds.push(val);
            }
        }
    }

    if (projectIds.length === 0) {
        dashboardContent.innerHTML = '<p style="padding:20px;">No projects found.</p>';
        return;
    }

    allProjectTasks = [];
    projectTeamCache = [];
    const uniqueEmails = new Set();
    const stats = { projectsLoaded: 0 };

    try {
        await Promise.all(projectIds.map(async (pid) => {
            try {
                // A. Fetch Project Doc (for Team & Date)
                const { data: pData } = await supabaseClient.from('projects').select('*').eq('id', pid).single();
                if (pData) {
                    // Store Start Date for Filtering
                    const sDate = pData.startDate || pData.Start_Date;
                    if (sDate) {
                        projectStartDates[pid] = new Date(sDate);
                    }

                    const teamFields = [
                        { field: "Project_RM", label: "RM" },
                        { field: "Project_FDD", label: "FDD" },
                        { field: "Project_Sec", label: "Sec" },
                        { field: "Project_PC", label: "PC" },
                        { field: "Project_AM", label: "AM" },
                        { field: "Project_Additional_mem_1", label: "Member" },
                        { field: "Project_Additional_mem_2", label: "Member" },
                        { field: "Project_Additional_mem_3", label: "Member" }
                    ];

                    for (const { field, label } of teamFields) {
                        const emailField = pData[field];
                        if (emailField && emailField.trim() !== "") {
                            const emails = emailField.split(",").map(e => e.trim()).filter(e => e !== "");
                            for (const email of emails) {
                                if (email && !uniqueEmails.has(email)) {
                                    uniqueEmails.add(email);
                                    let name = email;
                                    try {
                                        const { data: userDoc } = await supabaseClient.from('users').select('name').eq('email', email).single();
                                        if (userDoc && userDoc.name) name = userDoc.name;
                                    } catch (e) { }

                                    projectTeamCache.push({ role: label, name, email });
                                }
                            }
                        }
                    }
                }

                // B. Fetch Tasks
                const { data: tData } = await supabaseClient.from('tasks').select('*').eq('project_id', pid);
                if (tData) {
                    tData.forEach(doc => {
                        allProjectTasks.push({ ...doc, _sourceProject: pid });
                    });
                }
                stats.projectsLoaded++;

            } catch (err) {
                console.error(`Error loading aggregate data for ${pid}:`, err);
            }
        }));

        console.log(`DEBUG: Aggregate load complete. ${allProjectTasks.length} tasks from ${stats.projectsLoaded} projects.`);
        renderDashboard();

    } catch (e) {
        console.error("Error in aggregate load:", e);
        dashboardContent.innerHTML = `<p style="color:red; padding:20px;">Error loading data: ${e.message}</p>`;
    }
}

// Helper: Parse "W5", "5", or 5 to integer
function getWeekNumber(weekStr) {
    if (weekStr === undefined || weekStr === null) return 0;
    if (typeof weekStr === 'number') return weekStr;
    const match = weekStr.toString().match(/W?(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
}

// Logic to filter tasks based on time selection
function applyTimeFilter(tasks) {
    const filterSelect = document.getElementById("time-filter-select");
    if (!filterSelect) return tasks;

    const filter = filterSelect.value;
    if (filter === "all") return tasks;

    return tasks.filter(task => {
        // 1. Try Deadline Logic (New tasks)
        if (task.deadline) {
            const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
            const now = new Date();
            // Calculate Current Week Start/End/Etc?
            // Actually, "Till Last Week" means deadline < Start of This Week
            // "Till This Week" means deadline < Start of Next Week

            // Get start of current week (assuming Monday start?)
            const d = new Date(now);
            const day = d.getDay();
            const diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
            const mondayOfThisWeek = new Date(d.setDate(diff));
            mondayOfThisWeek.setHours(0, 0, 0, 0);

            const nextMonday = new Date(mondayOfThisWeek);
            nextMonday.setDate(mondayOfThisWeek.getDate() + 7);

            if (filter === "last-week") {
                return deadline < mondayOfThisWeek;
            } else if (filter === "this-week") {
                return deadline < nextMonday;
            }
            return true;
        }

        // 2. Fallback to Relative Week Logic (Old tasks)
        // We need the project start date to calculate CURRENT week for this project
        const pid = task._sourceProject || activeProjectSelect.value;
        const startDate = projectStartDates[pid];

        // If we don't know the start date, we can't filter accurately by week relative to now.
        if (!startDate) return true;

        const currentWeek = calculateCurrentWeek(startDate);
        // Support multiple field names: Week, targetWeek, week
        const taskWeek = getWeekNumber(task.Week || task.targetWeek || task.week);

        if (filter === "last-week") {
            // "Till Last Week" means anything before the current week
            return taskWeek < currentWeek;
        } else if (filter === "this-week") {
            // "Till This Week" means anything up to and including current week
            return taskWeek <= currentWeek;
        }
        return true;
    });
}

// Add event listener for Time Filter
const timeFilterSelect = document.getElementById("time-filter-select");
if (timeFilterSelect) {
    timeFilterSelect.addEventListener("change", () => {
        renderDashboard();
    });
}

function renderDashboard() {
    if (!allProjectTasks || allProjectTasks.length === 0) {
        dashboardContent.innerHTML = '<p style="padding:20px; color:#666;">No data available.</p>';
        return;
    }

    // APPLY FILTER HERE
    const filteredTasks = applyTimeFilter(allProjectTasks);

    const reportType = reportTypeSelect.value;
    if (reportType === "project") {
        generateProjectOverview(filteredTasks);
    } else {
        generateEmployeeReport(filteredTasks);
    }
}


function generateProjectOverview(tasksToRender) {
    // Exclude not_applicable tasks from ALL counts and displays
    const allTasks = tasksToRender || allProjectTasks;
    const tasks = allTasks.filter(t => t.requirement !== "not_applicable");

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const pending = tasks.filter(t => t.status === "pending").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const onHold = tasks.filter(t => t.status === "on_hold").length;
    const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);

    // On-time completion rate
    const now = new Date();
    const completedTasks = tasks.filter(t => t.status === "completed");
    const onTimeCount = completedTasks.filter(t => {
        if (!t.deadline || !t.endTime) return false;
        const deadline = t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline);
        const endTime = t.endTime.toDate ? t.endTime.toDate() : new Date(t.endTime);
        return endTime <= deadline;
    }).length;
    const onTimeRate = completedTasks.length === 0 ? "N/A" : Math.round((onTimeCount / completedTasks.length) * 100) + "%";

    // Tasks with open remarks
    const withRemarks = tasks.filter(t => t.remarks && t.remarks.length > 0).length;

    // Phase-wise progress
    const phases = {};
    tasks.forEach(t => {
        const phase = t.phase || "Unknown";
        if (!phases[phase]) phases[phase] = { total: 0, completed: 0 };
        phases[phase].total++;
        if (t.status === "completed") phases[phase].completed++;
    });
    const phaseKeys = Object.keys(phases).sort((a, b) => {
        const numA = parseInt((a.match(/\d+/) || [0])[0], 10);
        const numB = parseInt((b.match(/\d+/) || [0])[0], 10);
        return numA - numB;
    });

    const phaseBars = phaseKeys.map(ph => {
        const p = phases[ph];
        const pct = p.total === 0 ? 0 : Math.round((p.completed / p.total) * 100);
        const barColor = pct === 100 ? "#27ae60" : pct > 50 ? "#3498db" : "#f39c12";
        return `
            <div style="margin-bottom: 14px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:12px; font-weight:600; color:#2c3e50;">${ph}</span>
                    <span style="font-size:12px; color:#7f8c8d;">${p.completed}/${p.total} &nbsp;<strong>${pct}%</strong></span>
                </div>
                <div style="height:10px; background:#ecf0f1; border-radius:5px; overflow:hidden;">
                    <div style="width:${pct}%; background:${barColor}; height:100%; transition:width 0.4s ease;"></div>
                </div>
            </div>`;
    }).join("");

    // ── Employee stats for this project ──────────────────────────────────
    const now2 = new Date();
    const empStats = {};
    if (projectTeamCache && projectTeamCache.length > 0) {
        projectTeamCache.forEach(m => {
            if (m.email) empStats[m.email] = {
                name: m.name, role: m.role,
                total: 0, completed: 0, pending: 0, inProgress: 0,
                onTime: 0, totalDurationDays: 0, durationCount: 0,
                overduePending: 0, totalOverdueDays: 0
            };
        });
    }
    tasks.forEach(task => {
        const emailsString = task.actualAssigneeEmail || "Unassigned";
        const emailsRaw = emailsString.split(",").map(e => e.trim()).filter(e => e !== "");
        const finalEmails = emailsRaw.length > 0 ? emailsRaw : ["Unassigned"];

        finalEmails.forEach(email => {
            if (!empStats[email]) {
                empStats[email] = {
                    name: task.assigneeName || email.split("@")[0], role: task.assigneeRole || "N/A",
                    total: 0, completed: 0, pending: 0, inProgress: 0,
                    onTime: 0, totalDurationDays: 0, durationCount: 0,
                    overduePending: 0, totalOverdueDays: 0
                };
            }
            const s = empStats[email];
            s.total++;
            if (task.status === "completed") {
                s.completed++;
                if (task.startTime && task.endTime) {
                    const st = task.startTime.toDate ? task.startTime.toDate() : new Date(task.startTime);
                    const en = task.endTime.toDate ? task.endTime.toDate() : new Date(task.endTime);
                    const d = (en - st) / 86400000;
                    if (d >= 0) { s.totalDurationDays += d; s.durationCount++; }
                }
                if (task.deadline && task.endTime) {
                    const dl = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
                    const en = task.endTime.toDate ? task.endTime.toDate() : new Date(task.endTime);
                    if (en <= dl) s.onTime++;
                }
            } else if (task.status === "in_progress" || task.status === "on_hold") {
                s.inProgress++;
            } else if (task.status === "pending") {
                s.pending++;
                if (task.deadline) {
                    const dl = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
                    if (now2 > dl) { s.overduePending++; s.totalOverdueDays += (now2 - dl) / 86400000; }
                }
            }
        });
    });

    let empRows = "";
    Object.values(empStats).forEach(s => {
        const rate = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
        const otRate = s.completed === 0 ? "N/A" : Math.round((s.onTime / s.completed) * 100) + "%";
        const avgD = s.durationCount === 0 ? "N/A" : (s.totalDurationDays / s.durationCount).toFixed(1) + "d";
        const avgOvD = s.overduePending === 0 ? "—" : "+" + Math.round(s.totalOverdueDays / s.overduePending) + "d";
        const initial = s.name.charAt(0).toUpperCase();
        const ovStyle = s.overduePending > 0 ? "color:#e74c3c;font-weight:bold;" : "color:#27ae60;";
        const otColor = s.completed === 0 ? "#aaa" : (parseInt(otRate) >= 80 ? "#27ae60" : parseInt(otRate) >= 50 ? "#f39c12" : "#e74c3c");
        empRows += `
            <tr style="border-bottom:1px solid #f0f0f0;">
                <td style="display:flex;align-items:center;gap:8px;padding:10px 10px 10px 0;">
                    <div style="width:28px;height:28px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#fff;flex-shrink:0;">${initial}</div>
                    <div><div style="font-weight:600;color:#2c3e50;font-size:13px;">${s.name}</div><div style="font-size:11px;color:#888;">${s.role}</div></div>
                </td>
                <td style="padding:10px;font-weight:600;">${s.total}</td>
                <td style="padding:10px;color:#27ae60;font-weight:bold;">${s.completed}</td>
                <td style="padding:10px;color:#3498db;">${s.inProgress}</td>
                <td style="padding:10px;color:#f39c12;">${s.pending}</td>
                <td style="padding:10px;font-weight:bold;color:${otColor};">${otRate}</td>
                <td style="padding:10px;color:#8e44ad;">${avgD}</td>
                <td style="padding:10px;${ovStyle}">${s.overduePending > 0 ? "⚠ " + s.overduePending : "0"}</td>
                <td style="padding:10px;color:#e74c3c;font-size:12px;">${avgOvD}</td>
                <td style="padding:10px;">
                    <div style="width:65px;height:7px;background:#eee;border-radius:4px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:5px;"><div style="width:${rate}%;background:#2ecc71;height:100%;"></div></div>
                    <span style="font-size:11px;font-weight:bold;color:#555;">${rate}%</span>
                </td>
            </tr>`;
    });

    const html = `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Tasks</h3>
                <div class="value">${total}</div>
            </div>
            <div class="stat-card">
                <h3>Completed</h3>
                <div class="value" style="color:#27ae60;">${completed}</div>
            </div>
            <div class="stat-card">
                <h3>On-Time Rate</h3>
                <div class="value" style="color:#8e44ad;">${onTimeRate}</div>
                <div style="font-size:11px;color:#aaa;margin-top:4px;">${onTimeCount} of ${completedTasks.length} completed</div>
            </div>
            <div class="stat-card">
                <h3>Tasks with Remarks</h3>
                <div class="value" style="color:#e67e22;">${withRemarks}</div>
                <div style="font-size:11px;color:#aaa;margin-top:4px;">May need attention</div>
            </div>
            <div class="stat-card">
                <h3>In Progress</h3>
                <div class="value" style="color:#3498db;">${inProgress} <span style="font-size:12px;color:#7f8c8d;">(+${onHold} Hold)</span></div>
            </div>
            <div class="stat-card">
                <h3>Pending</h3>
                <div class="value" style="color:#f39c12;">${pending}</div>
            </div>
        </div>

        <div style="margin-top:24px; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom:8px;">Overall Progress</h3>
            <div style="height:28px; background:#ecf0f1; border-radius:14px; margin-top:12px; overflow:hidden; position:relative;">
                <div style="width:${progressPercent}%; background:#2ecc71; height:100%; transition:width 0.5s ease;"></div>
                <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#333;">${progressPercent}%</div>
            </div>
        </div>

        <div style="margin-top:24px; background:white; padding:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
            <h3 style="margin-bottom:16px;">Phase-wise Progress</h3>
            ${phaseKeys.length > 0 ? phaseBars : '<p style="color:#aaa; font-size:13px;">No phase data available.</p>'}
        </div>

        <div style="margin-top:24px;background:white;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.05);overflow:hidden;padding:20px;">
            <h3 style="margin-bottom:16px;">Employee Performance</h3>
            <table style="width:100%;border-collapse:collapse;">
                <thead style="background:#f8f9fa;border-bottom:2px solid #eee;">
                    <tr>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;">Employee</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;">Assigned</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;">Done</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;">In Prog</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;">Pending</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;" title="% completed before deadline">On-Time</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;" title="Avg start→complete">Avg Dur</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;" title="Pending past deadline">Overdue</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;" title="Avg days past deadline">Avg Ovr</th>
                        <th style="padding:10px;text-align:left;color:#7f8c8d;font-size:11px;text-transform:uppercase;">Completion</th>
                    </tr>
                </thead>
                <tbody style="font-size:13px;">${empRows}</tbody>
            </table>
        </div>
    `;

    dashboardContent.innerHTML = html + generateDebugHtml();
}

function generateEmployeeReport(tasksToRender) {
    const tasks = tasksToRender || allProjectTasks;
    const now = new Date();

    const stats = {};

    // Initialize all team members
    if (projectTeamCache && projectTeamCache.length > 0) {
        projectTeamCache.forEach(member => {
            if (member.email) {
                stats[member.email] = {
                    name: member.name, role: member.role,
                    total: 0, completed: 0, pending: 0, inProgress: 0,
                    onTime: 0, overdueCompleted: 0, totalDurationDays: 0, durationCount: 0,
                    overduePending: 0, totalOverdueDays: 0
                };
            }
        });
    }

    tasks.forEach(task => {
        const emailsString = task.actualAssigneeEmail || "Unassigned";
        const emailsRaw = emailsString.split(",").map(e => e.trim()).filter(e => e !== "");
        const finalEmails = emailsRaw.length > 0 ? emailsRaw : ["Unassigned"];

        finalEmails.forEach(email => {
            if (!stats[email]) {
                const name = task.assigneeName || (email === "Unassigned" ? "Unassigned" : email.split("@")[0]);
                stats[email] = {
                    name, role: task.assigneeRole || "N/A",
                    total: 0, completed: 0, pending: 0, inProgress: 0,
                    onTime: 0, overdueCompleted: 0, totalDurationDays: 0, durationCount: 0,
                    overduePending: 0, totalOverdueDays: 0
                };
            }
            const s = stats[email];
            s.total++;

            if (task.status === "completed") {
                s.completed++;
                // Avg duration
                if (task.startTime && task.endTime) {
                    const start = task.startTime.toDate ? task.startTime.toDate() : new Date(task.startTime);
                    const end = task.endTime.toDate ? task.endTime.toDate() : new Date(task.endTime);
                    const days = (end - start) / (1000 * 60 * 60 * 24);
                    if (days >= 0) { s.totalDurationDays += days; s.durationCount++; }
                }
                // On-time check
                if (task.deadline && task.endTime) {
                    const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
                    const end = task.endTime.toDate ? task.endTime.toDate() : new Date(task.endTime);
                    if (end <= deadline) s.onTime++; else s.overdueCompleted++;
                }
            } else if (task.status === "in_progress" || task.status === "on_hold") {
                s.inProgress++;
            } else if (task.status === "pending") {
                s.pending++;
                // Overdue pending: past deadline and still pending
                if (task.deadline) {
                    const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
                    if (now > deadline) {
                        s.overduePending++;
                        s.totalOverdueDays += (now - deadline) / (1000 * 60 * 60 * 24);
                    }
                }
            }
        });
    });

    let tableRows = "";
    Object.entries(stats).forEach(([email, s]) => {
        const rate = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
        const onTimeRate = s.completed === 0 ? "N/A" : Math.round((s.onTime / s.completed) * 100) + "%";
        const avgDays = s.durationCount === 0 ? "N/A" : (s.totalDurationDays / s.durationCount).toFixed(1) + "d";
        const avgOverdueDays = s.overduePending === 0 ? "—" : "+" + Math.round(s.totalOverdueDays / s.overduePending) + "d avg";
        const initial = s.name.charAt(0).toUpperCase();
        const overdueStyle = s.overduePending > 0 ? "color:#e74c3c; font-weight:bold;" : "color:#27ae60;";
        const onTimeColor = s.completed === 0 ? "#aaa" : (parseInt(onTimeRate) >= 80 ? "#27ae60" : parseInt(onTimeRate) >= 50 ? "#f39c12" : "#e74c3c");

        tableRows += `
            <tr class="employee-report-row" data-email="${email}" data-name="${s.name}" style="border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.backgroundColor='#f9f9f9'" onmouseout="this.style.backgroundColor='transparent'">
                <td style="display:flex; align-items:center; gap:10px; padding:12px 12px 12px 0;">
                    <div style="width:32px; height:32px; background:linear-gradient(135deg,#667eea,#764ba2); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:bold; color:#fff; flex-shrink:0;">${initial}</div>
                    <div>
                        <div style="font-weight:600; color:#2c3e50; font-size:13px;">${s.name}</div>
                        <div style="font-size:11px; color:#888;">${s.role}</div>
                    </div>
                </td>
                <td style="padding:12px; font-weight:600;">${s.total}</td>
                <td style="padding:12px; color:#27ae60; font-weight:bold;">${s.completed}</td>
                <td style="padding:12px; color:#3498db;">${s.inProgress}</td>
                <td style="padding:12px; color:#f39c12;">${s.pending}</td>
                <td style="padding:12px; font-weight:bold; color:${onTimeColor};">${onTimeRate}</td>
                <td style="padding:12px; color:#8e44ad;">${avgDays}</td>
                <td style="padding:12px; ${overdueStyle}">${s.overduePending > 0 ? "⚠ " + s.overduePending : "0"}</td>
                <td style="padding:12px; color:#e74c3c; font-size:12px; font-weight:${s.overduePending > 0 ? 'bold' : 'normal'};">${avgOverdueDays}</td>
                <td style="padding:12px;">
                    <div style="width:80px; height:7px; background:#eee; border-radius:4px; overflow:hidden; display:inline-block; vertical-align:middle; margin-right:6px;">
                        <div style="width:${rate}%; background:#2ecc71; height:100%;"></div>
                    </div>
                    <span style="font-size:11px; font-weight:bold; color:#555;">${rate}%</span>
                </td>
            </tr>
        `;
    });

    const html = `
        <div style="background:white; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); overflow:hidden; padding:20px;">
            <table style="width:100%; border-collapse:collapse;">
                <thead style="background:#f8f9fa; border-bottom:2px solid #eee;">
                    <tr>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;">Employee</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;">Assigned</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;">Completed</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;">In Progress</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;">Pending</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;" title="% of completed tasks finished before deadline">On-Time %</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;" title="Average time from Start to Complete">Avg Duration</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;" title="Pending tasks past their deadline">Overdue</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;" title="Average days past deadline for overdue pending tasks">Avg Overdue</th>
                        <th style="padding:12px; text-align:left; color:#7f8c8d; font-size:11px; text-transform:uppercase;">Completion</th>
                    </tr>
                </thead>
                <tbody style="font-size:13px;">
                    ${tableRows}
                </tbody>
            </table>
            <div style="text-align:center; padding-top:10px; font-size:12px; color:#888;">
                <em>Click any row to view the employee's historical performance chart.</em>
            </div>
        </div>
    `;

    dashboardContent.innerHTML = html + generateDebugHtml();

    // Attach click listeners for Employee Graph
    const rows = dashboardContent.querySelectorAll(".employee-report-row");
    rows.forEach(row => {
        row.addEventListener("click", () => {
            const rowEmail = row.getAttribute("data-email");
            const rowName = row.getAttribute("data-name");
            openEmployeeGraphModal(rowEmail, rowName);
        });
    });
}

function generateDebugHtml() {
    let debugHtml = '<div style="margin-top:20px; padding:10px; border:1px solid #ccc; background:#fff; font-size:12px; color:black;"><strong>Debug Info:</strong><br>';
    for (const [pid, date] of Object.entries(projectStartDates)) {
        // Safe check for date
        const dStr = date instanceof Date ? date.toDateString() : String(date);
        const cw = calculateCurrentWeek(date);
        debugHtml += `Project: ${pid} | Start: ${dStr} | Current Week: ${cw}<br>`;
    }
    debugHtml += '</div>';
    return debugHtml;
}

// ==========================================
// REMARKS / COMMENTS FEATURE
// ==========================================

// The task being annotated is stored here so the send button can reference it
let activeRemarkTask = null;

const remarksModal = document.getElementById("remarks-modal");
const closeRemarksModal = document.getElementById("close-remarks-modal");
const remarksThread = document.getElementById("remarks-thread");
const remarksTaskName = document.getElementById("remarks-task-name");
const remarkInput = document.getElementById("remark-input");
const sendRemarkBtn = document.getElementById("send-remark-btn");

/**
 * Open the remarks modal for a given task.
 * Populates the thread from task.remarks (already in memory).
 */
function openRemarksModal(task) {
    activeRemarkTask = task;
    remarksTaskName.textContent = task.taskName || "Task";
    remarkInput.value = "";
    renderRemarksThread(task.remarks || []);
    remarksModal.classList.remove("hidden");
    remarkInput.focus();
}

/**
 * Render remark bubbles in the thread container.
 */
function renderRemarksThread(remarks) {
    remarksThread.innerHTML = "";
    if (!remarks || remarks.length === 0) {
        remarksThread.innerHTML = '<p class="empty-remarks">No remarks yet. Be the first to add one!</p>';
        return;
    }

    remarks.forEach(remark => {
        const isOwn = remark.authorEmail === (userData && userData.email);
        const bubble = document.createElement("div");
        bubble.className = `remark-bubble${isOwn ? " own-remark" : ""}`;

        // Format timestamp
        let ts = "";
        if (remark.timestamp) {
            const d = remark.timestamp.toDate ? remark.timestamp.toDate() : new Date(remark.timestamp);
            ts = formatRelativeTime(d);
        }

        bubble.innerHTML = `
            <div class="remark-bubble-header">
                <span class="remark-author">${escapeHtml(remark.authorName || remark.authorEmail || "Unknown")}</span>
                <span class="remark-time">${ts}</span>
            </div>
            <div class="remark-text">${escapeHtml(remark.text || "")}</div>
        `;
        remarksThread.appendChild(bubble);
    });

    // Scroll to bottom
    remarksThread.scrollTop = remarksThread.scrollHeight;
}

/**
 * Format a date as relative time (e.g. "2 hours ago").
 */
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS in remark text
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Save a new remark to Firestore using arrayUnion.
 */
async function saveRemark() {
    const text = remarkInput.value.trim();
    if (!text || !activeRemarkTask) return;

    sendRemarkBtn.disabled = true;
    sendRemarkBtn.textContent = "Sending...";

    const newRemark = {
        text: text,
        authorName: userData.name || currentUser.displayName || currentUser.email,
        authorEmail: currentUser.email,
        timestamp: new Date()
    };

    try {
        const { error } = await supabaseClient.from('tasks').update({
            remarks: [...(activeRemarkTask.remarks || []), newRemark]
        }).eq('id', activeRemarkTask.id);

        if (error) throw error;

        // Optimistically update the local task object and re-render thread
        if (!activeRemarkTask.remarks) activeRemarkTask.remarks = [];
        activeRemarkTask.remarks.push(newRemark);
        remarkInput.value = "";
        renderRemarksThread(activeRemarkTask.remarks);

        console.log("Remark saved for task:", activeRemarkTask.id);
    } catch (err) {
        console.error("Error saving remark:", err);
        alert("Failed to save remark.");
    } finally {
        sendRemarkBtn.disabled = false;
        sendRemarkBtn.textContent = "Send";
    }
}

// Close remarks modal
closeRemarksModal.addEventListener("click", () => {
    remarksModal.classList.add("hidden");
    activeRemarkTask = null;
});

// Close on backdrop click
remarksModal.addEventListener("click", (e) => {
    if (e.target === remarksModal) {
        remarksModal.classList.add("hidden");
        activeRemarkTask = null;
    }
});

// Send remark on button click
sendRemarkBtn.addEventListener("click", saveRemark);

// Send remark on Ctrl+Enter / Cmd+Enter
remarkInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        sendRemarkBtn.click();
    }
});
// ==========================================
// REQUIREMENT FIELD LOGIC
// ==========================================

/**
 * Set the requirement classification for a task (RM/Admin only).
 * - applicable        → task proceeds normally
 * - not_applicable    → task hidden from all views and excluded from stats
 * - already_completed → task auto-marked completed with current timestamp
 */
async function setRequirement(task, value) {
    try {
        if (value === "not_applicable") {
            await supabaseClient.from('tasks').update({
                requirement: "not_applicable"
            }).eq('id', task.id);
            console.log(`Task ${task.id} marked as Not Applicable.`);
        } else if (value === "already_completed") {
            await supabaseClient.from('tasks').update({
                requirement: "already_completed",
                status: "completed",
                endTime: new Date().toISOString()
            }).eq('id', task.id);
            console.log(`Task ${task.id} marked as Already Completed.`);
        } else if (value === "applicable") {
            await supabaseClient.from('tasks').update({
                requirement: "applicable"
            }).eq('id', task.id);
            console.log(`Task ${task.id} marked as Applicable.`);
        }
        // onSnapshot will trigger a re-render automatically
    } catch (err) {
        console.error("Error setting requirement:", err);
        alert("Failed to set requirement: " + err.message);
    }
}

// ==========================================
// MANAGE PROJECTS LOGIC
// ==========================================

if (manageProjectsBtn) {
    manageProjectsBtn.addEventListener("click", () => {
        // Toggle view
        manageProjectsView.classList.remove("hidden");
        dashboardView.classList.add("hidden");
        if (actionSection) actionSection.classList.add("hidden");
        if (weekSection) weekSection.classList.add("hidden");
        if (completedSection) completedSection.classList.add("hidden");

        // Uncheck dashboard switch
        if (dashboardToggle) dashboardToggle.checked = false;

        renderManageProjectsView();
    });
}

if (backToDashboardBtn) {
    backToDashboardBtn.addEventListener("click", () => {
        manageProjectsView.classList.add("hidden");
        if (actionSection) actionSection.classList.remove("hidden");
        if (weekSection) weekSection.classList.remove("hidden");
        if (completedSection) completedSection.classList.remove("hidden");

        // Refresh project list just in case
        if (activeProjectSelect && activeProjectSelect.value) {
            loadProjectTasks(activeProjectSelect.value);
        }
    });
}

if (toggleCompletedProjectsBtn) {
    toggleCompletedProjectsBtn.addEventListener("click", () => {
        const isHidden = completedProjectsList.classList.contains("hidden");
        if (isHidden) {
            completedProjectsList.classList.remove("hidden");
            toggleCompletedProjectsBtn.textContent = "Hide Completed Projects";
        } else {
            completedProjectsList.classList.add("hidden");
            toggleCompletedProjectsBtn.textContent = "Show Completed Projects (Last 30 Days)";
        }
    });
}

async function renderManageProjectsView() {
    activeProjectsList.innerHTML = '<p style="padding:15px;color:#7f8c8d;">Loading projects...</p>';
    completedProjectsList.innerHTML = '<p style="padding:15px;color:#7f8c8d;">Loading completed projects...</p>';

    try {
        const { data: projectsSnap, error } = await supabaseClient.from('projects').select('*');
        if (error || !projectsSnap || projectsSnap.length === 0) {
            activeProjectsList.innerHTML = '<p style="padding:15px;">No projects found.</p>';
            completedProjectsList.innerHTML = '<p style="padding:15px;">No completed projects found.</p>';
            return;
        }

        const now = new Date();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        const activeProjects = [];
        const completedProjects = [];

        for (const p of projectsSnap) {
            // Standardize active if status not set
            const status = p.Project_Status || "active";

            if (status === "completed") {
                // Filter by 30 days if completionTime is present
                let isValidCompleted = true;
                if (p.completionTime) {
                    const ct = new Date(p.completionTime);
                    if (now - ct > thirtyDaysMs) {
                        isValidCompleted = false;
                    }
                }
                if (isValidCompleted) completedProjects.push(p);
            } else {
                activeProjects.push(p);
            }
        }

        // Sort both lists by Start Date descending
        const sortDesc = (a, b) => {
            const da = a.Start_Date ? new Date(a.Start_Date).getTime() : 0;
            const db = b.Start_Date ? new Date(b.Start_Date).getTime() : 0;
            return db - da; // newest first
        };
        activeProjects.sort(sortDesc);
        completedProjects.sort(sortDesc);

        // Render Active/On Hold
        if (activeProjects.length > 0) {
            let html = `<table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Project Name</th>
                        <th>Start Date</th>
                        <th title="Excludes 'Not Applicable' tasks">Total Tasks</th>
                        <th title="Excludes 'Not Applicable' tasks">Completed Tasks</th>
                        <th title="Excludes 'Not Applicable' tasks">Pending Tasks</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;

            // Fetch tracker stats
            const rowPromises = activeProjects.map(p => generateProjectRowHtml(p));
            const rows = await Promise.all(rowPromises);
            html += rows.join("") + "</tbody></table>";
            activeProjectsList.innerHTML = html;
        } else {
            activeProjectsList.innerHTML = '<p style="padding:15px;color:#7f8c8d;">No active projects.</p>';
        }

        // Render Completed
        if (completedProjects.length > 0) {
            let html = `<table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Project Name</th>
                        <th>Completion Date</th>
                        <th title="Excludes 'Not Applicable' tasks">Total</th>
                        <th title="Excludes 'Not Applicable' tasks">Completed</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>`;

            const rowPromises = completedProjects.map(p => generateProjectRowHtml(p, true));
            const rows = await Promise.all(rowPromises);
            html += rows.join("") + "</tbody></table>";
            completedProjectsList.innerHTML = html;
        } else {
            completedProjectsList.innerHTML = '<p style="padding:15px;color:#7f8c8d;">No completed projects in the last 30 days.</p>';
        }

        // Bind Action Buttons
        document.querySelectorAll(".mp-action-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const action = e.target.getAttribute("data-action");
                const pId = e.target.getAttribute("data-id");

                try {
                    if (action === "hold") {
                        e.target.disabled = true;
                        e.target.textContent = "Holding...";
                        await supabaseClient.from('projects').update({ Project_Status: "on_hold" }).eq('id', pId);
                        renderManageProjectsView(); // refresh
                    } else if (action === "start") {
                        e.target.disabled = true;
                        e.target.textContent = "Starting...";
                        await supabaseClient.from('projects').update({ Project_Status: "active" }).eq('id', pId);
                        renderManageProjectsView(); // refresh
                    } else if (action === "complete") {
                        if (confirm(`Are you sure you want to mark project ${pId} as Complete?\nIt will be moved to the completed container.`)) {
                            e.target.disabled = true;
                            e.target.textContent = "Completing...";
                            await supabaseClient.from('projects').update({
                                Project_Status: "completed",
                                completionTime: new Date().toISOString()
                            }).eq('id', pId);
                            renderManageProjectsView(); // refresh
                            // Refresh assigned dropdowns so completed drops out
                            loadProjects([]);
                        }
                    }
                } catch (err) {
                    console.error("Error updating project status:", err);
                    alert("Error updating project status.");
                    if (e.target) e.target.disabled = false;
                }
            });
        });

    } catch (err) {
        console.error("Error loading manage projects:", err);
        activeProjectsList.innerHTML = '<p style="padding:15px;color:#e74c3c;">Error loading projects data.</p>';
        completedProjectsList.innerHTML = '<p style="padding:15px;color:#e74c3c;">Error loading completed projects data.</p>';
    }
}

// Helper to format Date objects as dd-mmm-yyyy
function formatAsDDMMMYYYY(d) {
    if (!d || isNaN(d.getTime())) return "Invalid Date";
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = d.toLocaleString('en-US', { month: 'short' });
    const yyyy = d.getFullYear();
    return `${dd}-${mmm}-${yyyy}`;
}

async function generateProjectRowHtml(project, isCompletedView = false) {
    const pId = project.id;

    let total = 0, completed = 0, pending = 0;
    try {
        const { data: tasks, error } = await supabaseClient.from('tasks').select('requirement, status').eq('project_id', pId);
        if (!error && tasks) {
            tasks.forEach(data => {
                // Ignore not_applicable just like Dashboard KPIs
                if (data.requirement === "not_applicable") return;
                total++;
                if (data.status === "completed") completed++;
                else if (data.status === "pending") pending++;
            });
        }
    } catch (err) {
        console.error("Error fetching tasks for", pId, err);
    }

    // Formatting date
    let dateStr = "N/A";
    if (isCompletedView && project.completionTime) {
        const d = project.completionTime.toDate ? project.completionTime.toDate() : new Date(project.completionTime);
        dateStr = formatAsDDMMMYYYY(d);
    } else if (project.Start_Date) {
        // Handle various legacy representations of Start_Date
        if (typeof project.Start_Date === "string") {
            if (project.Start_Date.startsWith("Timestamp(seconds=")) {
                // Parse literal string e.g. "Timestamp(seconds=1770575400, nanoseconds=727000000)"
                const match = project.Start_Date.match(/seconds=(\d+)/);
                if (match && match[1]) {
                    dateStr = formatAsDDMMMYYYY(new Date(parseInt(match[1]) * 1000));
                } else {
                    dateStr = "Invalid Date";
                }
            } else {
                // Normal "YYYY-MM-DD" string or other format, parse into Date
                const d = new Date(project.Start_Date);
                if (!isNaN(d.getTime())) {
                    dateStr = formatAsDDMMMYYYY(d);
                } else {
                    dateStr = project.Start_Date; // fallback
                }
            }
        } else if (project.Start_Date.toDate) {
            dateStr = formatAsDDMMMYYYY(project.Start_Date.toDate());
        } else if (typeof project.Start_Date === "object" && project.Start_Date.seconds) {
            dateStr = formatAsDDMMMYYYY(new Date(project.Start_Date.seconds * 1000));
        } else {
            dateStr = "Unknown Format";
        }
    }

    const status = project.Project_Status || "active";

    if (isCompletedView) {
        return `
            <tr>
                <td style="font-weight:bold;">${pId}</td>
                <td>${project.Project_Name || project.projectName || "-"}</td>
                <td>${dateStr}</td>
                <td>${total}</td>
                <td style="color:#27ae60;font-weight:bold;">${completed}</td>
                <td><span class="task-meta" style="background:#ecf0f1; border: 1px solid #ddd; color: #555;">Completed</span></td>
            </tr>
        `;
    }

    let statusHtml = "";
    if (status === "active") statusHtml = `<span class="task-meta" style="background:#e8f4f8; color:#3498db; border: 1px solid #bde0fe; font-weight:bold; padding: 4px 8px;">Active</span>`;
    else if (status === "on_hold") statusHtml = `<span class="task-meta" style="background:#fcf3cf; color:#d35400; border: 1px solid #f9e79f; font-weight:bold; padding: 4px 8px;">On Hold</span>`;

    let actionsHtml = `<div class="manage-btn-group">`;
    if (status === "active") {
        actionsHtml += `<button class="btn-small btn-hold-small mp-action-btn" data-action="hold" data-id="${pId}">Hold</button>
                        <button class="btn-small btn-complete mp-action-btn" data-action="complete" data-id="${pId}">Complete</button>`;
    } else if (status === "on_hold") {
        actionsHtml += `<button class="btn-small btn-start mp-action-btn" data-action="start" data-id="${pId}">Start</button>`;
    }
    actionsHtml += `</div>`;

    return `
        <tr>
            <td style="font-weight:bold;">${pId}</td>
            <td>${project.Project_Name || "-"}</td>
            <td>${dateStr}</td>
            <td>${total}</td>
            <td style="color:#27ae60;font-weight:bold;">${completed}</td>
            <td style="color:#f39c12;font-weight:bold;">${pending}</td>
            <td>${statusHtml}</td>
            <td>${actionsHtml}</td>
        </tr>
    `;
}

// ==========================================
// EMPLOYEE PERFORMANCE GRAPH LOGIC
// ==========================================

let employeeChartInstance = null; // Store globally to destroy before re-render

const closeEmpGraphModal = document.getElementById("close-emp-graph-modal");
if (closeEmpGraphModal) {
    closeEmpGraphModal.addEventListener("click", () => {
        document.getElementById("employee-graph-modal").classList.add("hidden");
    });
}

function openEmployeeGraphModal(email, name) {
    const modal = document.getElementById("employee-graph-modal");
    const titleEl = document.getElementById("emp-graph-title");
    const subtitleEl = document.getElementById("emp-graph-subtitle");
    const canvas = document.getElementById("emp-performance-chart");

    if (!modal || !canvas) return;

    titleEl.textContent = `Performance: ${name}`;
    subtitleEl.textContent = `Email: ${email}`;

    // 1. Get all tasks strictly assigned to this email
    const myTasks = allProjectTasks.filter(t => {
        if (t.requirement === "not_applicable") return false;
        if (!t.actualAssigneeEmail) return false;
        const emails = t.actualAssigneeEmail.split(",").map(e => e.trim());
        return emails.includes(email);
    });

    if (myTasks.length === 0) {
        alert("No tasks assigned to " + name + " yet.");
        return;
    }

    // 2. Helper to get Monday of a given date at 00:00 (for weekly bucketing)
    function getMonday(d) {
        const dt = new Date(d);
        const day = dt.getDay();
        const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(dt.setDate(diff));
        mon.setHours(0, 0, 0, 0);
        return mon;
    }

    // 3. For each task, compute introduced Monday and completed Monday
    const taskDetails = myTasks.map(t => {
        // Find projectId in data or fallback
        const pid = t.projectId || t._sourceProject;
        if (!pid || !projectStartDates[pid]) return null;

        const sDateData = projectStartDates[pid];
        const sDate = sDateData.toDate ? sDateData.toDate() : new Date(sDateData);

        const targetWeek = t.targetWeek || t.Week || t.week || 1;
        // Introduced date = Project Start + (Weeks - 1)
        const introDate = new Date(sDate.getTime() + (targetWeek - 1) * 7 * 86400000);
        const introMonday = getMonday(introDate).getTime();

        let compMonday = null;
        if (t.status === "completed" && t.endTime) {
            const eDate = t.endTime.toDate ? t.endTime.toDate() : new Date(t.endTime);
            compMonday = getMonday(eDate).getTime();
        }

        return { introMonday, compMonday };
    }).filter(t => t !== null);

    if (taskDetails.length === 0) {
        alert("No valid timeline data available for " + name);
        return;
    }

    // 4. Find the min and max Mondays
    let minMonday = Number.MAX_SAFE_INTEGER;
    let maxMonday = getMonday(new Date()).getTime();

    taskDetails.forEach(t => {
        if (t.introMonday < minMonday) minMonday = t.introMonday;
        if (t.compMonday && t.compMonday > maxMonday) maxMonday = t.compMonday;
    });

    if (minMonday > maxMonday) minMonday = maxMonday;

    // 5. Build timeline buckets
    const weeks = [];
    let currentM = minMonday;
    while (currentM <= maxMonday) {
        weeks.push(currentM);
        currentM += 7 * 86400000;
    }

    // 6. Calculate stats per week
    const labels = [];
    const dataPoints = [];
    const tooltipData = [];

    weeks.forEach(weekMs => {
        const dateObj = new Date(weekMs);
        const labelStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        labels.push("Week of " + labelStr);

        let thisWeekActive = 0;
        let thisWeekCompleted = 0;
        let rolloverActive = 0;
        let rolloverCompleted = 0;

        taskDetails.forEach(t => {
            // Task is active if introduced before/during this week AND NOT completed strictly before this week
            if (t.introMonday <= weekMs) {
                if (!t.compMonday || t.compMonday >= weekMs) {

                    if (t.introMonday === weekMs) {
                        thisWeekActive++;
                        if (t.compMonday === weekMs) thisWeekCompleted++;
                    } else {
                        rolloverActive++;
                        if (t.compMonday === weekMs) rolloverCompleted++;
                    }
                }
            }
        });

        const activeCount = thisWeekActive + rolloverActive;
        const completedCount = thisWeekCompleted + rolloverCompleted;

        let score = 0;
        if (activeCount > 0) {
            // Formula: (Completed/Active - 1) * 100
            score = ((completedCount / activeCount) - 1) * 100;
        }
        dataPoints.push(Math.round(score));

        tooltipData.push({
            totalActive: activeCount,
            totalCompleted: completedCount,
            thisWeekActive: thisWeekActive,
            thisWeekCompleted: thisWeekCompleted,
            rolloverActive: rolloverActive,
            rolloverCompleted: rolloverCompleted
        });
    });

    // 7. Render Chart
    modal.classList.remove("hidden");

    if (employeeChartInstance) {
        employeeChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    employeeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance Score (%)',
                data: dataPoints,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#c0392b',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: -100,
                    max: 0, // Performance max is mathematically 0 under this framework, or maybe >0 if early?
                    title: {
                        display: true,
                        text: 'Score (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Timeline'
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const idx = context.dataIndex;
                            const td = tooltipData[idx];
                            const lines = [
                                `Score: ${context.parsed.y}%`,
                                `Total Tasks: ${td.totalCompleted}/${td.totalActive}`,
                                `This Week: ${td.thisWeekCompleted}/${td.thisWeekActive}`,
                                `Rollover: ${td.rolloverCompleted}/${td.rolloverActive}`
                            ];
                            return lines;
                        }
                    }
                },
                legend: {
                    position: 'top',
                }
            }
        }
    });
}
