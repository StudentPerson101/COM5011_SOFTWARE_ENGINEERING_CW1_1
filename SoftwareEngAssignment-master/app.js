//DATA MODELS
class Zone {
    constructor(id, name, hasSprinklers, hasShutdown, hasExitIndicators) {
        this.id = id;
        this.name = name;
        this.hasSprinklers = hasSprinklers;
        this.hasShutdown = hasShutdown;
        this.hasExitIndicators = hasExitIndicators;
        this.isIsolated = false;
    }
}

class Alarm {
    constructor(id, zoneId, zoneName, type) {
        this.id = id;
        this.zoneId = zoneId;
        this.zoneName = zoneName;
        this.type = type;
        this.status = 'active';
        this.confirmed = false;
        this.timestamp = new Date();
        this.sensorCount = 1;
        this.peoplePresent = false;
    }
}

//Zone 
const zones = [
    new Zone(1, 'Zone A1 - East Wing', true, true, true),
    new Zone(2, 'Zone A2 - West Wing', true, false, true),
    new Zone(3, 'Zone B1 - Security Area', false, false, true),
    new Zone(4, 'Zone B2 - Main Hall', true, true, true),
    new Zone(5, 'Zone C1 - Server Room', true, true, false)
];

let alarms = [];
let nextAlarmId = 100;
let staffingManned = true;
let eventLogs = [];

function addLog(message, severity = 'INFO') {
    const logEntry = {
        id: Date.now(),
        timestamp: new Date(),
        severity: severity,
        message: message
    };
    eventLogs.unshift(logEntry);
    if (eventLogs.length > 30) eventLogs.pop();
    renderLog();
}

function getZoneById(zoneId) {
    return zones.find(z => z.id === zoneId);
}

function hasSeriousActiveAlarm() {
    return alarms.some(a => a.status === 'active' && a.confirmed === true);
}

function autoCallEmergencyServices(triggeringAlarm) {
    if (!staffingManned && hasSeriousActiveAlarm()) {
        addLog(`AUTO-CALL: Emergency services notified - ${triggeringAlarm.type.toUpperCase()} in ${triggeringAlarm.zoneName}`, 'CRITICAL');
        return true;
    }
    return false;
}

//VISUAL AUDIBLE ALARM
function showAudibleAlarm() {
    const container = document.getElementById('audibleAlarmContainer');
    if (container) container.style.display = 'block';
    renderResponses();
}

function hideAudibleAlarm() {
    const container = document.getElementById('audibleAlarmContainer');
    if (container) container.style.display = 'none';
    renderResponses();
}

function updateAudibleAlarm() {
    const fireConfirmed = alarms.some(a => a.type === 'fire' && a.confirmed && a.status !== 'resolved');
    if (fireConfirmed) {
        showAudibleAlarm();
    } else {
        hideAudibleAlarm();
    }
}

//CORE LOGIC**
function evaluateAndConfirmAlarm(alarm) {
    if (alarm.confirmed) return false;
    
    let wasConfirmed = false;
    
    if (alarm.type === 'fire') {
        if (alarm.sensorCount >= 2) {
            alarm.confirmed = true;
            wasConfirmed = true;
            addLog(`FIRE CONFIRMED in ${alarm.zoneName} (${alarm.sensorCount} sensors)`, 'CRITICAL');
            
            const zone = getZoneById(alarm.zoneId);
            
            if (zone && zone.hasExitIndicators) {
                addLog(`Exit indicators ACTIVATED in ${zone.name}`, 'WARNING');
            }
            addLog(`Evacuation alarm ACTIVATED (visual indicator)`, 'WARNING');
            
            if (!alarm.peoplePresent) {
                if (zone && zone.hasSprinklers) addLog(`Sprinklers ACTIVATED in ${zone.name}`, 'WARNING');
                if (zone && zone.hasShutdown) addLog(`Electrical SHUTDOWN in ${zone.name}`, 'WARNING');
            } else {
                addLog(`People present in ${alarm.zoneName} - Sprinklers/Shutdown NOT activated (Safety priority)`, 'INFO');
            }
            
            autoCallEmergencyServices(alarm);
            updateAudibleAlarm();
        }
    } 
    else if (alarm.type === 'security') {
        alarm.confirmed = true;
        wasConfirmed = true;
        addLog(`SECURITY CONFIRMED in ${alarm.zoneName}`, 'WARNING');
        addLog(`Internal doors LOCKED in ${alarm.zoneName}`, 'WARNING');
        
        const zone = getZoneById(alarm.zoneId);
        if (zone) {
            zone.isIsolated = true;
            addLog(`Zone ${zone.name} ISOLATED`, 'WARNING');
        }
        
        autoCallEmergencyServices(alarm);
    }
    
    if (wasConfirmed) {
        renderAlarms();
        renderZones();
        renderResponses();
        updateStats();
    }
    
    return wasConfirmed;
}

function simulateSecondSensor(alarmId) {
    setTimeout(() => {
        const alarm = alarms.find(a => a.id === alarmId && a.status === 'active');
        if (alarm && alarm.type === 'fire' && !alarm.confirmed && alarm.sensorCount === 1) {
            alarm.sensorCount = 2;
            addLog(`Second sensor triggered in ${alarm.zoneName} - Auto-confirming`, 'WARNING');
            evaluateAndConfirmAlarm(alarm);
            renderAlarms();
            renderResponses();
            updateStats();
        }
    }, 3000);
}

//API FUNCTIONS
function simulateFireAlarm(zoneId = 1) {
    const zone = getZoneById(zoneId);
    if (!zone) return;
    
    const existingAlarm = alarms.find(a => a.zoneId === zone.id && a.type === 'fire' && a.status === 'active');
    
    if (existingAlarm) {
        existingAlarm.sensorCount++;
        addLog(`Additional fire sensor in ${zone.name} (Total: ${existingAlarm.sensorCount})`, 'WARNING');
        evaluateAndConfirmAlarm(existingAlarm);
    } else {
        const newAlarm = new Alarm(nextAlarmId++, zone.id, zone.name, 'fire');
        newAlarm.peoplePresent = false;
        alarms.push(newAlarm);
        addLog(`FIRE ALARM in ${zone.name} (Awaiting confirmation)`, 'CRITICAL');
        simulateSecondSensor(newAlarm.id);
    }
    
    renderAlarms();
    renderZones();
    renderResponses();
    updateStats();
}

function simulateSecurityAlarm(zoneId = 3) {
    const zone = getZoneById(zoneId);
    if (!zone) return;
    
    const existingAlarm = alarms.find(a => a.zoneId === zone.id && a.type === 'security' && a.status === 'active');
    
    if (existingAlarm) {
        addLog(`Security alarm already active in ${zone.name}`, 'INFO');
        return;
    }
    
    const newAlarm = new Alarm(nextAlarmId++, zone.id, zone.name, 'security');
    alarms.push(newAlarm);
    addLog(`SECURITY ALARM in ${zone.name}`, 'WARNING');
    evaluateAndConfirmAlarm(newAlarm);
    
    renderAlarms();
    renderZones();
    renderResponses();
    updateStats();
}

function acknowledgeAlarm(alarmId) {
    const alarm = alarms.find(a => a.id === alarmId);
    if (alarm && alarm.status === 'active') {
        alarm.status = 'acknowledged';
        addLog(`Operator ACKNOWLEDGED ${alarm.type} in ${alarm.zoneName}`, 'INFO');
        evaluateAndConfirmAlarm(alarm);
        renderAlarms();
        renderResponses();
        updateStats();
    }
}

function resolveAlarm(alarmId) {
    const index = alarms.findIndex(a => a.id === alarmId);
    if (index !== -1) {
        const alarm = alarms[index];
        addLog(`RESOLVED ${alarm.type} alarm in ${alarm.zoneName}`, 'INFO');
        alarms.splice(index, 1);
        
        const hasSecurityAlarms = alarms.some(a => a.type === 'security' && a.status === 'active');
        if (!hasSecurityAlarms) {
            zones.forEach(zone => { zone.isIsolated = false; });
            addLog(`All zones UNLOCKED`, 'INFO');
        }
        
        updateAudibleAlarm();
        renderAlarms();
        renderZones();
        renderResponses();
        updateStats();
    }
}

function resetSystem() {
    if (confirm('Reset all alarms?')) {
        alarms = [];
        zones.forEach(zone => { zone.isIsolated = false; });
        addLog(`System RESET - All alarms cleared`, 'INFO');
        updateAudibleAlarm();
        renderAlarms();
        renderZones();
        renderResponses();
        updateStats();
    }
}

function toggleStaffing() {
    staffingManned = !staffingManned;
    const status = staffingManned ? 'MANNED' : 'UNMANNED';
    addLog(`Control area set to ${status}`, 'INFO');
    
    const badge = document.getElementById('staffingStatus');
    if (staffingManned) {
        badge.innerHTML = 'MANNED';
        badge.className = 'status-badge manned';
    } else {
        badge.innerHTML = 'UNMANNED';
        badge.className = 'status-badge unmanned';
    }
    
    if (!staffingManned && hasSeriousActiveAlarm()) {
        const seriousAlarm = alarms.find(a => a.confirmed && a.status === 'active');
        if (seriousAlarm) autoCallEmergencyServices(seriousAlarm);
    }
    
    renderResponses();
}

function clearLog() {
    eventLogs = [];
    addLog('Log cleared', 'INFO');
}

//UI RENDERING ------> Frontend
function renderZones() {
    const container = document.getElementById('zonesList');
    if (!container) return;
    
    let html = '<div class="zones-container">';
    zones.forEach(zone => {
        const isIsolated = zone.isIsolated;
        html += `
            <div class="zone-card ${isIsolated ? 'zone-isolated' : ''}">
                <div class="zone-name">
                    ${zone.name}
                    ${isIsolated ? '<span class="zone-isolated-tag"> [ISOLATED]</span>' : ''}
                </div>
                <div class="zone-details">
                    ID: ${zone.id}
                </div>
                <div class="zone-equipment">
                    ${zone.hasSprinklers ? '<span class="equipment-tag">Sprinklers</span>' : ''}
                    ${zone.hasShutdown ? '<span class="equipment-tag">Elec Shutdown</span>' : ''}
                    ${zone.hasExitIndicators ? '<span class="equipment-tag">Exit Indicators</span>' : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderAlarms() {
    const container = document.getElementById('alarmList');
    if (!container) return;
    
    const activeAlarms = alarms.filter(a => a.status === 'active' || a.status === 'acknowledged');
    
    if (activeAlarms.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No active alarms</div>';
        return;
    }
    
    let html = '<table class="alarm-table"><thead><tr>';
    html += '<th>Zone</th><th>Type</th><th>Status</th><th>Confirmed</th><th>Sensors</th><th>Actions</th>';
    html += '</tr></thead><tbody>';
    
    activeAlarms.forEach(alarm => {
        html += `<tr class="${alarm.type}-row ${alarm.confirmed ? 'confirmed-row' : ''}">`;
        html += `<td>${alarm.zoneName}</td>`;
        html += `<td><span class="zone-badge ${alarm.type === 'fire' ? 'zone-fire' : 'zone-security'}">${alarm.type}</span></td>`;
        html += `<td>${alarm.status}</td>`;
        html += `<td>${alarm.confirmed ? 'Confirmed' : 'Pending'}</td>`;
        html += `<td>${alarm.sensorCount}</td>`;
        html += `<td>`;
        if (!alarm.confirmed) {
            html += `<button class="btn" style="background:#667eea; padding:2px 8px; margin-right:5px;" onclick="acknowledgeAlarm(${alarm.id})">Acknowledge</button>`;
        }
        html += `<button class="btn btn-danger" style="padding:2px 8px;" onclick="resolveAlarm(${alarm.id})">Resolved</button>`;
        html += `</button></td>`;
        html += `</tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderResponses() {
    const container = document.getElementById('responsesPanel');
    if (!container) return;
    
    const fireConfirmed = alarms.some(a => a.type === 'fire' && a.confirmed && a.status !== 'resolved');
    const securityConfirmed = alarms.some(a => a.type === 'security' && a.confirmed && a.status !== 'resolved');
    const peopleInFireZone = alarms.some(a => a.type === 'fire' && a.peoplePresent && a.status !== 'resolved');
    const audibleActive = fireConfirmed;
    
    const html = `
        <div class="response-panel">
            <strong>FIRE RESPONSES</strong><br>
            <div class="response-item ${fireConfirmed ? 'response-active' : 'response-inactive'}">
                Exit Indicators: ${fireConfirmed ? 'ACTIVATED' : 'Inactive'}
            </div>
            <div class="response-item ${fireConfirmed ? 'response-active' : 'response-inactive'}">
                Audible Alarm: ${fireConfirmed ? 'ACTIVE (visual indicator)' : 'Inactive'}
            </div>
            <div class="response-item ${fireConfirmed && !peopleInFireZone ? 'response-active' : 'response-inactive'}">
                Sprinklers: ${fireConfirmed && !peopleInFireZone ? 'ACTIVATED' : peopleInFireZone ? 'DISABLED (People present)' : 'Inactive'}
            </div>
            <div class="response-item ${fireConfirmed && !peopleInFireZone ? 'response-active' : 'response-inactive'}">
                Elec Shutdown: ${fireConfirmed && !peopleInFireZone ? 'ACTIVATED' : peopleInFireZone ? 'DISABLED (People present)' : 'Inactive'}
            </div>
            <div class="response-item ${fireConfirmed && !staffingManned ? 'response-active' : 'response-inactive'}">
                Emergency Call: ${fireConfirmed ? (staffingManned ? 'Awaiting operator' : 'AUTO-CALLED') : 'Not called'}
            </div>
        </div>
        <div class="response-panel">
            <strong>SECURITY RESPONSES</strong><br>
            <div class="response-item ${securityConfirmed ? 'response-active' : 'response-inactive'}">
                Door Locks: ${securityConfirmed ? 'LOCKED' : 'Unlocked'}
            </div>
            <div class="response-item ${securityConfirmed ? 'response-active' : 'response-inactive'}">
                Zone Isolation: ${securityConfirmed ? 'ACTIVATED' : 'Inactive'}
            </div>
            <div class="response-item ${securityConfirmed && !staffingManned ? 'response-active' : 'response-inactive'}">
                Security Notify: ${securityConfirmed ? (staffingManned ? 'Awaiting operator' : 'AUTO-NOTIFIED') : 'Standby'}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderLog() {
    const container = document.getElementById('eventLog');
    if (!container) return;
    
    if (eventLogs.length === 0) {
        container.innerHTML = '<div class="log-entry">No events</div>';
        return;
    }
    
    container.innerHTML = eventLogs.slice(0, 15).map(log => {
        let severityClass = '';
        if (log.severity === 'CRITICAL') severityClass = 'log-critical';
        else if (log.severity === 'WARNING') severityClass = 'log-warning';
        else severityClass = 'log-info';
        
        return `<div class="log-entry ${severityClass}">
                    [${log.timestamp.toLocaleTimeString()}] ${log.message}
                </div>`;
    }).join('');
}

function updateStats() {
    const activeAlarms = alarms.filter(a => a.status !== 'resolved').length;
    const confirmedAlarms = alarms.filter(a => a.confirmed && a.status !== 'resolved').length;
    const uniqueZones = new Set(alarms.filter(a => a.status !== 'resolved').map(a => a.zoneId)).size;
    
    const activeEl = document.getElementById('activeAlarmsCount');
    const confirmedEl = document.getElementById('confirmedAlarmsCount');
    const zonesEl = document.getElementById('zonesAffected');
    
    if (activeEl) activeEl.textContent = activeAlarms;
    if (confirmedEl) confirmedEl.textContent = confirmedAlarms;
    if (zonesEl) zonesEl.textContent = uniqueZones;
}

//INITIALIZATION***
function init() {
    addLog('FASAM System Ready', 'INFO');
    addLog(`${zones.length} zones configured`, 'INFO');
    
    zones.forEach(zone => {
        addLog(`Zone ${zone.id}: ${zone.name} - Sprinklers: ${zone.hasSprinklers}, Shutdown: ${zone.hasShutdown}, Exit Indicators: ${zone.hasExitIndicators}`, 'INFO');
    });
    
    renderZones();
    renderAlarms();
    renderResponses();
    updateStats();
    hideAudibleAlarm();
    
    const fireZoneBtn = document.getElementById('simulateFireZoneBtn');
    const securityZoneBtn = document.getElementById('simulateSecurityZoneBtn');
    const resetBtn = document.getElementById('resetSystemBtn');
    const toggleBtn = document.getElementById('toggleStaffingBtn');
    const clearBtn = document.getElementById('clearLogBtn');
    const zoneSelect = document.getElementById('zoneSelect');
    
    if (fireZoneBtn && zoneSelect) fireZoneBtn.onclick = () => simulateFireAlarm(parseInt(zoneSelect.value));
    if (securityZoneBtn && zoneSelect) securityZoneBtn.onclick = () => simulateSecurityAlarm(parseInt(zoneSelect.value));
    if (resetBtn) resetBtn.onclick = resetSystem;
    if (toggleBtn) toggleBtn.onclick = toggleStaffing;
    if (clearBtn) clearBtn.onclick = clearLog;
}

window.acknowledgeAlarm = acknowledgeAlarm;
window.resolveAlarm = resolveAlarm;

window.addEventListener('DOMContentLoaded', init);