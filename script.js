(function () {
	let teamsData = [];
	let pitchingTeamIndex = ''; // Index of pitching team
	let battingTeamIndex = ''; // Index of batting team
	let currentPitcherIndex = -1; // Index of currently selected pitcher
	let currentBatterIndex = -1; // Index of currently selected batter
	let pdModifier = 0; // Pitcher Delivery modifier for Batter Response
	let brOutcome = ''; // Batter Response outcome for fielder determination
	let tabs = {}; // Store tab content
	let activeTab = null; // Track active tab
	let outs = 0; // Track outs in current inning
	let currentInning = 1; // Track current inning
	let isTopInning = true; // Track if top or bottom of inning
	let fielderData = {}; // Store fielder information (name, code, glove stat)
	let runners = { '1b': null, '2b': null, '3b': null }; // Track runners on bases
	let teamScores = { pitching: 0, batting: 0 }; // Track runs scored per team
	let highlightedFielder = null; // Track which fielder is highlighted
	let useManualRolls = false; // Toggle for manual dice rolls
	let lastManualRoll = null; // Store last manual roll input
	let doublePlayAttempt = null; // Track DP attempt state (e.g., { phase: 'toSecond', runnerOnFirst: 'name' })
	let throwTarget = '1b'; // Track current throw target base
	let playLog = []; // Track play log entries

	function updateOutcomeDisplay(summary) {
		// Display outcome as a single summary line
		document.getElementById('outcome-line1').textContent = summary;
		document.getElementById('outcome-line2').textContent = '';
		document.getElementById('outcome-line3').textContent = '';
	}

	function getRandomRoll(sides, description = '') {
		if (useManualRolls) {
			return getManualRoll(sides, description);
		}
		return Math.floor(Math.random() * sides) + 1;
	}

	function getManualRoll(sides, description = '') {
		let roll;
		const prompt_text = description 
			? `Enter ${description} (D${sides}, 1-${sides}):`
			: `Enter a D${sides} roll (1-${sides}):`;
		
		while (true) {
			const input = prompt(prompt_text);
			if (input === null) return Math.floor(Math.random() * sides) + 1; // Cancel - use auto roll
			
			roll = parseInt(input);
			if (!isNaN(roll) && roll >= 1 && roll <= sides) {
				lastManualRoll = roll;
				return roll;
			}
			alert(`Invalid input. Please enter a number between 1 and ${sides}.`);
		}
	}

	function createTab(tabId, tabLabel, content, isHTML = false) {
		// Create tab button
		const tabsHeader = document.getElementById('tabs-header');
		if (!document.getElementById(`tab-${tabId}`)) {
			const tabButton = document.createElement('button');
			tabButton.id = `tab-${tabId}`;
			tabButton.className = 'tab';
			tabButton.textContent = tabLabel;
			tabButton.addEventListener('click', () => switchTab(tabId));
			tabsHeader.appendChild(tabButton);
		}

		// Store tab content
		tabs[tabId] = content;

		// Create or update tab pane
		let tabPane = document.getElementById(`pane-${tabId}`);
		if (!tabPane) {
			tabPane = document.createElement('div');
			tabPane.id = `pane-${tabId}`;
			tabPane.className = 'tab-pane';
			document.getElementById('tabs-content').appendChild(tabPane);
		}
		
		if (isHTML) {
			tabPane.innerHTML = content;
		} else {
			tabPane.textContent = content;
		}

		// Switch to this tab
		switchTab(tabId);
	}

	function createTableRow(value, label, isSeparator = false) {
		const rowClass = isSeparator ? ' class="table-separator"' : '';
		return `<tr${rowClass}><td>${label}</td><td>${value}</td></tr>`;
	}

	function createTableHeader() {
		return `<table class="data-table"><thead><tr><th>Value Source</th><th>Value</th></tr></thead><tbody>`;
	}

	function closeTable() {
		return `</tbody></table>`;
	}

	function switchTab(tabId) {
		// Deactivate all tabs
		document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
		document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

		// Activate selected tab
		const tabButton = document.getElementById(`tab-${tabId}`);
		const tabPane = document.getElementById(`pane-${tabId}`);
		if (tabButton) tabButton.classList.add('active');
		if (tabPane) tabPane.classList.add('active');

		activeTab = tabId;
	}

	function addPlayLogEntry(message, isInningStart = false) {
		// Add an entry to the play log
		playLog.push(message);
		
		const logContainer = document.getElementById('play-log-entries');
		if (logContainer) {
			const entry = document.createElement('div');
			entry.className = isInningStart ? 'play-log-entry inning-start' : 'play-log-entry';
			entry.textContent = message;
			logContainer.insertBefore(entry, logContainer.firstChild);
			
			// Keep only the last 50 entries
			while (logContainer.children.length > 50) {
				logContainer.removeChild(logContainer.lastChild);
			}
		}
	}

	function logInningStart() {
		// Log the start of a new inning
		const inningPosition = isTopInning ? 'Top' : 'Bottom';
		const inningOrdinal = currentInning === 1 ? '1st' : currentInning === 2 ? '2nd' : currentInning === 3 ? '3rd' : `${currentInning}th`;
		const message = `═══ ${inningPosition} ${inningOrdinal} Inning ═══`;
		addPlayLogEntry(message, true);
	}

	function logPlay(battingTeamName, playerName, description) {
		// Log a single play
		// Example: logPlay('Rat Stack', 'doneZo', 'flies out to right fielder Travis')
		const message = `${playerName} ${description}`;
		addPlayLogEntry(message);
	}

	function updateBasesDisplay() {
		// Update the bases display with runner names and team colors
		const bases = ['1b', '2b', '3b'];
		const teamColorMap = {
			0: 'team-rat-stack',        // Rat Stack - Purple
			1: 'team-content-kings',    // Content Kings - Blue
			2: 'team-nine-lives',       // Nine-Lives Nine - Yellow
			3: 'team-straw-hats'        // Straw Hat Pirates - Red
		};
		
		// Update home base with current batter
		const homeElement = document.getElementById('runner-home');
		if (homeElement && currentBatterIndex !== -1) {
			const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
			homeElement.textContent = batter.name;
			homeElement.classList.remove('team-rat-stack', 'team-content-kings', 'team-nine-lives', 'team-straw-hats', 'occupied');
			homeElement.classList.add('occupied');
			const teamColorClass = teamColorMap[battingTeamIndex];
			if (teamColorClass) {
				homeElement.classList.add(teamColorClass);
			}
		}
		
		bases.forEach(base => {
			const element = document.getElementById(`runner-${base}`);
			if (element) {
				// Remove all team color classes first
				element.classList.remove('team-rat-stack', 'team-content-kings', 'team-nine-lives', 'team-straw-hats', 'occupied');
				
				if (runners[base]) {
					element.textContent = runners[base];
					element.classList.add('occupied');
					
					// Find the runner's team and apply team color
					const battingTeam = teamsData[battingTeamIndex];
					const runner = battingTeam.players.find(p => p.name === runners[base]);
					if (runner) {
						// Runners are from the batting team, so use batting team's color
						const teamColorClass = teamColorMap[battingTeamIndex];
						if (teamColorClass) {
							element.classList.add(teamColorClass);
						}
					}
				} else {
					element.textContent = '-';
				}
			}
		});
	}

	function applyRunnerAnimation(basesToAnimate) {
		// Apply running animation to specified bases
		// basesToAnimate: array of base names like ['1b', '2b'] that are receiving runners
		basesToAnimate.forEach(base => {
			const element = document.getElementById(`runner-${base}`);
			if (element) {
				element.classList.remove('running');
				// Trigger reflow to restart animation
				void element.offsetWidth;
				element.classList.add('running');
				// Remove animation class after it completes
				setTimeout(() => {
					element.classList.remove('running');
				}, 850);
			}
		});
	}

	function updateScoreDisplay() {
		// Update the score display for both teams
		const pitchingTeamNameElem = document.getElementById('pitching-team-name');
		const battingTeamNameElem = document.getElementById('batting-team-name');
		const pitchingScoreElem = document.getElementById('pitching-team-score');
		const battingScoreElem = document.getElementById('batting-team-score');

		if (pitchingTeamNameElem && teamsData[pitchingTeamIndex]) {
			pitchingTeamNameElem.textContent = teamsData[pitchingTeamIndex].name;
		}
		if (battingTeamNameElem && teamsData[battingTeamIndex]) {
			battingTeamNameElem.textContent = teamsData[battingTeamIndex].name;
		}
		if (pitchingScoreElem) {
			pitchingScoreElem.textContent = teamScores.pitching;
		}
		if (battingScoreElem) {
			battingScoreElem.textContent = teamScores.batting;
		}
	}

	function updateOutsDisplay() {
		// Update the outs display
		const outsCountElem = document.getElementById('outs-count');
		if (outsCountElem) {
			outsCountElem.textContent = outs;
		}
	}

	function updateInningDisplay() {
		// Update the inning display
		const inningTextElem = document.getElementById('inning-text');
		if (inningTextElem) {
			const inningPosition = isTopInning ? 'Top' : 'Bottom';
			const inningOrdinal = currentInning === 1 ? '1st' : currentInning === 2 ? '2nd' : currentInning === 3 ? '3rd' : `${currentInning}th`;
			inningTextElem.textContent = `${inningPosition} ${inningOrdinal}`;
		}
	}

	function advanceToNextHalfInning() {
		// When 3 outs occur, advance to next half inning and swap teams
		if (isTopInning) {
			// Switch to bottom of same inning
			isTopInning = false;
		} else {
			// Switch to top of next inning
			isTopInning = true;
			currentInning++;
		}
		
		// Swap pitching and batting teams for the new half inning
		const tempIndex = pitchingTeamIndex;
		pitchingTeamIndex = battingTeamIndex;
		battingTeamIndex = tempIndex;
		
		// Swap the scores as well - pitching team's new score becomes old batting score
		const tempScore = teamScores.pitching;
		teamScores.pitching = teamScores.batting;
		teamScores.batting = tempScore;
		
		// Update team selection dropdowns to reflect the swap
		document.getElementById('pitchingTeamSelect').value = pitchingTeamIndex;
		document.getElementById('battingTeamSelect').value = battingTeamIndex;
		
		// Reset runners on base for new half inning
		runners = { '1b': null, '2b': null, '3b': null };
		
		outs = 0;
		updateOutsDisplay();
		updateInningDisplay();
		updateScoreDisplay();
		updateBasesDisplay();
		logInningStart();
		populateRostersForTeams();
		updatePitcherSelect();
		updateBatterSelect();
		
		// Auto-select the primary pitcher for the new pitching team
		const team = teamsData[pitchingTeamIndex];
		const primaryPitcher = team.players.findIndex(player => player.position === "P");
		if (primaryPitcher !== -1) {
			document.getElementById('pitcherSelect').value = primaryPitcher;
			setCurrentPitcher(primaryPitcher);
		}
		
		// Auto-select the first batter for the new batting team
		const battingTeam = teamsData[battingTeamIndex];
		const firstBatter = battingTeam.players.findIndex(player => player.battingOrder === 1);
		if (firstBatter !== -1) {
			document.getElementById('batterSelect').value = firstBatter;
			setCurrentBatter(firstBatter);
		}
		
		clearResults();
	}

	function highlightFielder(fielderPosition, color = 'yellow') {
		// Get the fielding team (pitching team)
		const team = teamsData[pitchingTeamIndex];
		if (!team || !team.players) return;
		
		// Find the player with this position (prioritize primary position over secondary)
		let fielder = team.players.find(p => p.position === fielderPosition);
		if (!fielder) {
			fielder = team.players.find(p => p.secondaryPos === fielderPosition);
		}
		if (!fielder) return;
		
		// Find their index in the roster
		const fielderIndex = team.players.indexOf(fielder);
		if (fielderIndex === -1) return;
		
		// Store the highlighted fielder info
		highlightedFielder = { index: fielderIndex, color: color };
		
		// Clear fielding highlights only (keep 'selected' class for pitcher)
		const rosterItems = document.querySelectorAll('#left-roster-list .roster-item');
		rosterItems.forEach((item, index) => {
			// Remove fielding highlight classes
			item.classList.remove('fielding-highlight-yellow', 'fielding-highlight-red', 'fielding-highlight-green');
			
			// Apply fielder highlight to correct index
			if (index === fielderIndex) {
				item.classList.add(`fielding-highlight-${color}`);
			}
		});
	}

	function highlightFielderByName(playerName, color = 'yellow') {
		// Get the fielding team (pitching team)
		const team = teamsData[pitchingTeamIndex];
		if (!team || !team.players) return;
		
		// Find the player by name
		const fielder = team.players.find(p => p.name === playerName);
		if (!fielder) return;
		
		// Find their index in the roster
		const fielderIndex = team.players.indexOf(fielder);
		if (fielderIndex === -1) return;
		
		// Store the highlighted fielder info
		highlightedFielder = { index: fielderIndex, color: color };
		
		// Clear all highlights first, then highlight the fielder
		const rosterItems = document.querySelectorAll('#left-roster-list .roster-item');
		rosterItems.forEach((item, index) => {
			// Remove all highlight and selected classes
			item.classList.remove('fielding-highlight-yellow', 'fielding-highlight-red', 'fielding-highlight-green', 'selected');
			
			// Apply fielder highlight to correct index
			if (index === fielderIndex) {
				item.classList.add(`fielding-highlight-${color}`);
			}
		});
	}

	function clearFielderHighlight() {
		// Remove all highlight classes from all roster items
		const rosterItems = document.querySelectorAll('#left-roster-list .roster-item');
		rosterItems.forEach(item => {
			item.classList.remove('fielding-highlight-yellow', 'fielding-highlight-red', 'fielding-highlight-green');
		});
	}

	function updateFielderHighlightColor(handled) {
		// Change fielder highlight color based on handle result
		// Green = Handled (successful), Red = Not Handled (unsuccessful)
		const rosterItems = document.querySelectorAll('#left-roster-list .roster-item');
		rosterItems.forEach(item => {
			if (item.classList.contains('fielding-highlight-yellow')) {
				item.classList.remove('fielding-highlight-yellow');
				if (handled) {
					item.classList.add('fielding-highlight-green');
				} else {
					item.classList.add('fielding-highlight-red');
				}
			}
		});
	}

	function populateTeamSelects() {
		const pitchingTeamSelect = document.getElementById('pitchingTeamSelect');
		const battingTeamSelect = document.getElementById('battingTeamSelect');
		
		if (!pitchingTeamSelect || !battingTeamSelect) {
			console.error('Team select elements not found');
			return;
		}
		
		// Clear existing options except the placeholder
		while (pitchingTeamSelect.options.length > 1) {
			pitchingTeamSelect.remove(1);
		}
		while (battingTeamSelect.options.length > 1) {
			battingTeamSelect.remove(1);
		}
		
		if (!teamsData || teamsData.length === 0) {
			console.error('teamsData is empty:', teamsData);
			return;
		}
		
		teamsData.forEach((team, index) => {
			const option1 = document.createElement('option');
			option1.value = index;
			option1.textContent = team.name;
			pitchingTeamSelect.appendChild(option1);
			
			const option2 = document.createElement('option');
			option2.value = index;
			option2.textContent = team.name;
			battingTeamSelect.appendChild(option2);
		});
		
		// Reset selects to show default placeholder
		pitchingTeamSelect.value = '';
		battingTeamSelect.value = '';
	}

	function onPitchingTeamChange() {
		const teamIndex = parseInt(document.getElementById('pitchingTeamSelect').value);
		if (teamIndex !== -1 && !isNaN(teamIndex)) {
			pitchingTeamIndex = teamIndex;
			populateRostersForTeams();
			updatePitcherSelect();
			updateScoreDisplay();
			
			// Reset outs and inning when starting a new game
			outs = 0;
			currentInning = 1;
			isTopInning = true;
			updateOutsDisplay();
			updateInningDisplay();
			
			// Auto-select the primary pitcher (position: "P")
			const team = teamsData[teamIndex];
			const primaryPitcher = team.players.findIndex(player => player.position === "P");
			if (primaryPitcher !== -1) {
				document.getElementById('pitcherSelect').value = primaryPitcher;
				setCurrentPitcher(primaryPitcher);
				clearResults();
			}
		}
	}

	function onBattingTeamChange() {
		const teamIndex = parseInt(document.getElementById('battingTeamSelect').value);
		if (teamIndex !== -1 && !isNaN(teamIndex)) {
			battingTeamIndex = teamIndex;
			populateRostersForTeams();
			updateBatterSelect();
			updateScoreDisplay();
			
			// Auto-select the first batter (lowest battingOrder)
			const team = teamsData[teamIndex];
			const firstBatter = team.players.findIndex(player => player.battingOrder === 1);
			if (firstBatter !== -1) {
				document.getElementById('batterSelect').value = firstBatter;
				setCurrentBatter(firstBatter);
				clearResults();
			}
		}
	}

	function setCurrentPitcher(playerIndex) {
		currentPitcherIndex = parseInt(playerIndex);
		populateRostersForTeams();
		updateRosterHighlight();
		updateZoneDisplay();
	}

	function setCurrentBatter(playerIndex) {
		currentBatterIndex = parseInt(playerIndex);
		populateRostersForTeams();
		updateRosterHighlight();
		updateZoneDisplay();
	}

	function getTeamColorClass(teamIndex) {
		const colorMap = {
			0: 'team-rat-stack',        // Rat Stack - Purple
			1: 'team-content-kings',    // Content Kings - Blue
			2: 'team-nine-lives',       // Nine-Lives Nine - Yellow
			3: 'team-straw-hats'        // Straw Hat Pirates - Red
		};
		return colorMap[teamIndex] || '';
	}

	function getBaserunnerColorClass(playerName) {
		// Find which team this player belongs to
		for (let i = 0; i < teamsData.length; i++) {
			const team = teamsData[i];
			if (team.players.some(p => p.name === playerName)) {
				const colorMap = {
					0: 'baserunner-rat-stack',
					1: 'baserunner-content-kings',
					2: 'baserunner-nine-lives',
					3: 'baserunner-straw-hats'
				};
				return colorMap[i] || '';
			}
		}
		return '';
	}

	function populateRostersForTeams() {
		const leftRoster = document.getElementById('left-roster-list');
		const rightRoster = document.getElementById('right-roster-list');
		const leftRosterPanel = document.getElementById('left-roster');
		const rightRosterPanel = document.getElementById('right-roster');
		
		leftRoster.innerHTML = '';
		rightRoster.innerHTML = '';
		
		// Remove all team color classes from roster panels
		leftRosterPanel.className = 'roster-panel';
		rightRosterPanel.className = 'roster-panel';
		
		// Populate left roster (pitching team)
		if (pitchingTeamIndex !== '') {
			const pitchingTeam = teamsData[pitchingTeamIndex];
			const teamColor = getTeamColorClass(pitchingTeamIndex);
			leftRosterPanel.classList.add(teamColor);
			
			pitchingTeam.players.forEach((player, index) => {
				const rosterItem = document.createElement('div');
				rosterItem.className = 'roster-item';
				let roleLabel = '';
				let isBaserunner = false;
				if (index === currentPitcherIndex) {
					roleLabel = '<span class="roster-role">Role: Pitching</span>';
				} else if (highlightedFielder && highlightedFielder.index === index) {
					roleLabel = '<span class="roster-role">Role: Fielding</span>';
				} else {
					// Check if this player is a runner on base
					let baseStatus = '';
					if (runners['1b'] === player.name) baseStatus = ' (1B)';
					else if (runners['2b'] === player.name) baseStatus = ' (2B)';
					else if (runners['3b'] === player.name) baseStatus = ' (3B)';
					
					if (baseStatus) {
						roleLabel = '<span class="roster-role">Role: Baserunning' + baseStatus + '</span>';
						isBaserunner = true;
						const baserunnerColorClass = getBaserunnerColorClass(player.name);
						if (baserunnerColorClass) {
							rosterItem.classList.add(baserunnerColorClass);
						}
					}
				}
				rosterItem.innerHTML = `
					<div class="roster-item-content">
						<span class="roster-item-name">${player.name}</span>
						<span class="roster-item-position">${player.position}</span>
					</div>
					${roleLabel}
				`;
				leftRoster.appendChild(rosterItem);
			});
		}
		
		// Populate right roster (batting team)
		if (battingTeamIndex !== '') {
			const battingTeam = teamsData[battingTeamIndex];
			const teamColor = getTeamColorClass(battingTeamIndex);
			rightRosterPanel.classList.add(teamColor);
			
			battingTeam.players.forEach((player, index) => {
				const rosterItem = document.createElement('div');
				rosterItem.className = 'roster-item';
				let roleLabel = '';
				if (index === currentBatterIndex) {
					roleLabel = '<span class="roster-role">Role: Batting</span>';
				} else {
					// Check if this player is a runner on base
					let baseStatus = '';
					if (runners['1b'] === player.name) baseStatus = ' (1B)';
					else if (runners['2b'] === player.name) baseStatus = ' (2B)';
					else if (runners['3b'] === player.name) baseStatus = ' (3B)';
					
					if (baseStatus) {
						roleLabel = '<span class="roster-role">Role: Baserunning' + baseStatus + '</span>';
						const baserunnerColorClass = getBaserunnerColorClass(player.name);
						if (baserunnerColorClass) {
							rosterItem.classList.add(baserunnerColorClass);
						}
					}
				}
				rosterItem.innerHTML = `
					<div class="roster-item-content">
						<span class="roster-item-name">${player.name}</span>
						<span class="roster-item-position">${player.position}</span>
					</div>
					${roleLabel}
				`;
				rightRoster.appendChild(rosterItem);
			});
		}
		
		updateRosterHighlight();
		
		// Restore fielder highlighting if one was previously highlighted
		if (highlightedFielder) {
			const rosterItems = document.querySelectorAll('#left-roster-list .roster-item');
			rosterItems.forEach((item, index) => {
				if (index === highlightedFielder.index) {
					item.classList.add(`fielding-highlight-${highlightedFielder.color}`);
				}
			});
		}
	}

	function updatePitcherSelect() {
		const pitcherSelect = document.getElementById('pitcherSelect');
		pitcherSelect.innerHTML = '<option value="" disabled selected hidden>Select Pitcher</option>';
		
		if (pitchingTeamIndex !== '' && !isNaN(pitchingTeamIndex)) {
			const team = teamsData[pitchingTeamIndex];
			if (team && team.players) {
				team.players.forEach((player, index) => {
					const hasPitchingStats = (player.control + player.velocity + player.stamina) > 0;
					if (hasPitchingStats) {
						const option = document.createElement('option');
						option.value = index;
						option.textContent = player.name;
						pitcherSelect.appendChild(option);
					}
				});
			}
		}
	}

	function updateBatterSelect() {
		const batterSelect = document.getElementById('batterSelect');
		batterSelect.innerHTML = '<option value="" disabled selected hidden>Select Batter</option>';
		
		if (battingTeamIndex !== '' && !isNaN(battingTeamIndex)) {
			const team = teamsData[battingTeamIndex];
			if (team && team.players) {
				team.players.forEach((player, index) => {
					const option = document.createElement('option');
					option.value = index;
					option.textContent = player.name;
					batterSelect.appendChild(option);
				});
			}
		}
	}

	function onPitcherSelectChange() {
		const pitcherIndex = document.getElementById('pitcherSelect').value;
		if (pitcherIndex !== '') {
			setCurrentPitcher(parseInt(pitcherIndex));
		}
	}

	function onBatterSelectChange() {
		const batterIndex = document.getElementById('batterSelect').value;
		if (batterIndex !== '') {
			setCurrentBatter(parseInt(batterIndex));
		}
	}

	function nextBatter() {
		if (battingTeamIndex === '' || battingTeamIndex === -1) return;
		
		const team = teamsData[battingTeamIndex];
		if (!team || !team.players) return;
		
		// Check if we have 3 outs
		if (outs >= 3) {
			advanceToNextHalfInning();
			return;
		}
		
		// Reset highlighted fielder
		highlightedFielder = null;
		
		// Find next batter in batting order
		const currentBattingOrder = team.players[currentBatterIndex].battingOrder;
		let nextBattingOrder = currentBattingOrder + 1;
		
		// Wrap around to first batter if we're at the end
		if (nextBattingOrder > 9) {
			nextBattingOrder = 1;
		}
		
		// Find player with next batting order
		const nextBatterIndex = team.players.findIndex(player => player.battingOrder === nextBattingOrder);
		if (nextBatterIndex !== -1) {
			document.getElementById('batterSelect').value = nextBatterIndex;
			setCurrentBatter(nextBatterIndex);
			clearResults();
		}
	}

	function updateNextBatterButton() {
		const button = document.getElementById('nextBatterButton');
		if (outs >= 3) {
			button.textContent = 'Next Inning';
		} else {
			button.textContent = 'Next Batter';
		}
	}

	function updateZoneDisplay() {
		if (pitchingTeamIndex === '' || battingTeamIndex === '' || currentPitcherIndex === -1 || currentBatterIndex === -1) {
			document.getElementById('zone-display').style.display = 'none';
			return;
		}
		
		const pitcher = teamsData[pitchingTeamIndex].players[currentPitcherIndex];
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		const pitchingTeamName = teamsData[pitchingTeamIndex].name;
		const battingTeamName = teamsData[battingTeamIndex].name;
		
		// Update pitcher card
		document.getElementById('pitcher-team-name').textContent = pitchingTeamName;
		document.getElementById('pitcher-name').textContent = pitcher.name;
		document.getElementById('pitcher-control').textContent = pitcher.control;
		document.getElementById('pitcher-velocity').textContent = pitcher.velocity;
		document.getElementById('pitcher-stamina').textContent = pitcher.stamina;
		document.getElementById('pitcher-arm').textContent = pitcher.arm;
		
		// Update batter card
		document.getElementById('batter-team-name').textContent = battingTeamName;
		document.getElementById('batter-name').textContent = batter.name;
		document.getElementById('batter-contact').textContent = batter.contact;
		document.getElementById('batter-power').textContent = batter.power;
		document.getElementById('batter-eye').textContent = batter.eye;
		document.getElementById('batter-speed').textContent = batter.speed;
		
		// Update roster highlighting
		updateRosterHighlight();
		
		document.getElementById('zone-display').style.display = 'block';
	}

	function updateRosterHighlight() {
		const leftItems = document.querySelectorAll('#left-roster-list .roster-item');
		const rightItems = document.querySelectorAll('#right-roster-list .roster-item');
		
		leftItems.forEach((item, index) => {
			item.classList.remove('selected');
			if (index === currentPitcherIndex) {
				item.classList.add('selected');
			}
		});
		
		rightItems.forEach((item, index) => {
			item.classList.remove('selected');
			if (index === currentBatterIndex) {
				item.classList.add('selected');
			}
		});
	}

	function clearResults() {
		document.getElementById('outcome-line1').textContent = '';
		document.getElementById('outcome-line2').textContent = '';
		document.getElementById('outcome-line3').textContent = '';
		document.getElementById('pitch-baseball').classList.remove('show');
		clearFielderHighlight();
		document.getElementById('startButton').disabled = false;
		document.getElementById('batterResponseButton').disabled = true;
		document.getElementById('determineFielderButton').disabled = true;
		document.getElementById('handleCheckButton').disabled = true;
		// Clear tabs
		document.getElementById('tabs-header').innerHTML = '';
		document.getElementById('tabs-content').innerHTML = '';
		tabs = {};
		activeTab = null;
		brOutcome = '';
		// Reset bases display for new at-bat
		updateBasesDisplay();
		updateNextBatterButton();
	}

	function addRunnerToBase(baseName) {
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		runners[baseName] = batter.name;
		// Animate the runner being added to the base
		applyRunnerAnimation([baseName]);
	}

	function advanceRunners() {
		// Move runners forward one base: 3B→score, 2B→3B, 1B→2B
		// Use temporary variables to avoid overwriting during sequential operations
		const runner3b = runners['3b'];
		const runner2b = runners['2b'];
		const runner1b = runners['1b'];
		
		// Track which bases are receiving runners for animation
		const basesToAnimate = [];
		
		// Runner on 3B scores
		if (runner3b) {
			teamScores.batting++;
		}
		
		// Advance remaining runners
		if (runner2b) {
			runners['3b'] = runner2b;
			basesToAnimate.push('3b');
		} else {
			runners['3b'] = null;
		}
		
		if (runner1b) {
			runners['2b'] = runner1b;
			basesToAnimate.push('2b');
		} else {
			runners['2b'] = null;
		}
		runners['1b'] = null;
		
		// Apply animation to bases receiving runners
		if (basesToAnimate.length > 0) {
			applyRunnerAnimation(basesToAnimate);
		}
	}

	function advanceRunnersOnWalk() {
		// For walks: runners advance only if forced by priority (occupied bases closer to batter)
		// 1B runner: ALWAYS forced (batter taking 1B)
		// 2B runner: Forced to 3B only if 1B is also occupied (1B runner pushes them)
		// 3B runner: Forced to score only if both 1B and 2B are occupied (full chain)
		const runner3b = runners['3b'];
		const runner2b = runners['2b'];
		const runner1b = runners['1b'];
		
		// Build the new state step by step
		let new1b = null; // Batter will be added after, so 1B is always empty initially
		let new2b = null;
		let new3b = null;
		const basesToAnimate = [];
		
		// 1B runner always advances to 2B (batter is coming to 1B)
		if (runner1b) {
			new2b = runner1b;
			basesToAnimate.push('2b');
		}
		
		// 2B runner advances to 3B only if 1B is occupied (forced chain)
		if (runner2b && runner1b) {
			new3b = runner2b;
			basesToAnimate.push('3b');
		} else if (runner2b) {
			// 2B runner stays at 2B if not forced
			new2b = runner2b;
		}
		
		// 3B runner scores only if both 1B and 2B are occupied (full forced chain)
		if (runner3b && runner2b && runner1b) {
			flashBase('home');
			teamScores.batting++;
			// new3b stays null since runner scored
		} else if (runner3b) {
			// 3B runner stays at 3B if not part of full forced advance
			new3b = runner3b;
		}
		
		runners['1b'] = new1b;
		runners['2b'] = new2b;
		runners['3b'] = new3b;
		
		// Apply animation to bases receiving runners
		if (basesToAnimate.length > 0) {
			applyRunnerAnimation(basesToAnimate);
		}
	}

	function hasRunners() {
		// Check if any runners are on base
		return runners['1b'] !== null || runners['2b'] !== null || runners['3b'] !== null;
	}

	function advanceRunnersMultipleBases(bases) {
		// Advance runners by specified number of bases (1 for single, 4 for home run)
		// Track which runners score - score goes to batting team
		const basesToAnimate = [];
		
		if (bases >= 4) {
			// Home run: all runners score, including runner on 3B
			if (runners['3b']) {
				teamScores.batting++;
				runners['3b'] = null;
			}
			if (runners['2b']) {
				teamScores.batting++;
				runners['2b'] = null;
			}
			if (runners['1b']) {
				teamScores.batting++;
				runners['1b'] = null;
			}
			// Batter also scores on home run
			teamScores.batting++;
		} else if (bases === 1) {
			// Single: advance by 1 base
			if (runners['3b']) {
				teamScores.batting++;
				runners['3b'] = null;
			}
			if (runners['2b']) {
				runners['3b'] = runners['2b'];
				runners['2b'] = null;
				basesToAnimate.push('3b');
			}
			if (runners['1b']) {
				runners['2b'] = runners['1b'];
				runners['1b'] = null;
				basesToAnimate.push('2b');
			}
		}
		
		// Apply animation to bases receiving runners
		if (basesToAnimate.length > 0) {
			applyRunnerAnimation(basesToAnimate);
		}
	}


	function determineFielder() {
		let fielderType;
		switch(brOutcome) {
			case 'Dribbler':
			case 'Bloop':
			case 'Screamer*':
				fielderType = 'INF';
				break;
			case 'Can of Corn':
			case 'Laser':
				fielderType = 'OF';
				break;
			default:
				fielderType = '';
		}
		
		let fielderName;
		let fielderCode;
		let gloveStat = 0;
		let tabContent;
		if (fielderType === 'INF') {
			const roll = getRandomRoll(20, 'Infielder Selection Die');
			if (roll <= 3) {
				fielderName = 'Pitcher';
				fielderCode = 'P';
			} else if (roll <= 5) {
				fielderName = 'Catcher';
				fielderCode = 'C';
			} else if (roll <= 8) {
				fielderName = 'First Base';
				fielderCode = '1B';
			} else if (roll <= 12) {
				fielderName = 'Second Base';
				fielderCode = '2B';
			} else if (roll <= 16) {
				fielderName = 'Shortstop';
				fielderCode = 'SS';
			} else {
				fielderName = 'Third Base';
				fielderCode = '3B';
			}
			tabContent = `${createTableHeader()}${createTableRow(roll, 'Infielder Selection Die (D20)')}${createTableRow(fielderName, 'Result', true)}${closeTable()}`;
		} else if (fielderType === 'OF') {
			const roll = getRandomRoll(6, 'Outfielder Selection Die');
			if (roll <= 2) {
				fielderName = 'Left Fielder';
				fielderCode = 'LF';
			} else if (roll <= 4) {
				fielderName = 'Center Fielder';
				fielderCode = 'CF';
			} else {
				fielderName = 'Right Fielder';
				fielderCode = 'RF';
			}
			tabContent = `${createTableHeader()}${createTableRow(roll, 'Outfielder Selection Die (D6)')}${createTableRow(fielderName, 'Result', true)}${closeTable()}`;
		}
		
		// Get fielder's glove stat from player data
		const pitchingTeam = teamsData[pitchingTeamIndex];
		let armStat = 0;
		let actualFielderName = fielderName; // Keep position name for display
		
		if (pitchingTeam && fielderCode) {
			// Find the player at this fielding position
			const fielder = pitchingTeam.players.find(p => p.position === fielderCode || p.secondaryPos === fielderCode);
			if (fielder) {
				gloveStat = fielder.glove;
				armStat = fielder.arm;
				actualFielderName = fielder.name; // Use actual player name
			}
		}
		
		// Store fielder data for handle check and throw attempt
		fielderData = {
			name: actualFielderName,
			code: fielderCode,
			glove: gloveStat,
			arm: armStat
		};
		
		// Create Fielder tab if content exists
		if (tabContent) {
			createTab('fielder', 'DF', tabContent, true);
			// Highlight the fielder in the roster by position code
			highlightFielder(fielderCode);
			// Show fielder info in outcome display
			document.getElementById('outcome-line2').textContent = `${fielderName} attempting to field`;
			document.getElementById('outcome-line2').style.display = 'block';
			// Enable handle check button
			document.getElementById('handleCheckButton').disabled = false;
			// Disable the determine fielder button after it's been clicked
			document.getElementById('determineFielderButton').disabled = true;
		}
	}

	function performTagUp(fielderData) {
		// Determine which runners can tag up (on 2nd or 3rd)
		const runner3b = runners['3b'];
		const runner2b = runners['2b'];
		let tagUpResults = [];
		
		// If runner on 3rd, they roll confidence to attempt to score
		if (runner3b) {
			const runner3bPlayer = teamsData[battingTeamIndex].players.find(p => p.name === runner3b);
			if (runner3bPlayer) {
				const confidenceRoll = getRandomRoll(6, runner3b + ' Confidence Die');
				const confidence = confidenceRoll + runner3bPlayer.speed;
				
				const tagUpInfo = {
					runner: runner3b,
					base: '3b',
					target: 'home',
					confidenceRoll: confidenceRoll,
					speed: runner3bPlayer.speed,
					confidence: confidence,
					hasConfidence: confidence >= 4
				};
				tagUpResults.push(tagUpInfo);
				
				// If confidence >= 4, runner attempts to score
				if (confidence >= 4) {
					flashBase('home');
					performTagUpThrow(runner3b, '3b', 'home', fielderData, tagUpResults);
				}
				
				// If runner on 2nd exists, they advance to 3b automatically (lead runner is going)
				if (runner2b) {
					runners['3b'] = runner2b;
					runners['2b'] = null;
				}
			}
		} 
		// If only runner on 2nd (no one on 3rd), they roll confidence to attempt to go to 3b
		else if (runner2b) {
			const runner2bPlayer = teamsData[battingTeamIndex].players.find(p => p.name === runner2b);
			if (runner2bPlayer) {
				const confidenceRoll = getRandomRoll(6, runner2b + ' Confidence Die');
				const confidence = confidenceRoll + runner2bPlayer.speed;
				
				const tagUpInfo = {
					runner: runner2b,
					base: '2b',
					target: '3b',
					confidenceRoll: confidenceRoll,
					speed: runner2bPlayer.speed,
					confidence: confidence,
					hasConfidence: confidence >= 4
				};
				tagUpResults.push(tagUpInfo);
				
				// If confidence >= 4, runner attempts to advance to 3b
				if (confidence >= 4) {
					performTagUpThrow(runner2b, '2b', '3b', fielderData, tagUpResults);
				}
			}
		}
		
		// Create TAG tab with all results
		if (tagUpResults.length > 0) {
			let tagTabContent = createTableHeader();
			
			tagUpResults.forEach((info, index) => {
				if (info.throwResult) {
					// This runner had a throw attempt
					tagTabContent += createTableRow(info.runner, 'Runner');
					tagTabContent += createTableRow(info.confidenceRoll, 'Confidence Die (D6)');
					tagTabContent += createTableRow(info.speed, "Runner's Speed");
					tagTabContent += createTableRow(info.confidence, 'Total Confidence', true);
					tagTabContent += `<tr style="background: #e3f2fd;"><td>Decision</td><td style="font-weight: 600; color: #0d47a1;">Attempts to ${info.target === 'home' ? 'score' : 'advance'}</td></tr>`;
					
					// Throw results
					tagTabContent += `<tr style="background: #fff3e0; border-top: 2px solid #ff9800;"><td colspan="2" style="font-weight: 600; padding: 8px;">TAG UP THROW TO ${info.target.toUpperCase()}</td></tr>`;
					tagTabContent += createTableRow(info.runnerRoll, "Runner's Die (D6)");
					tagTabContent += createTableRow(info.speed, "Runner's Speed");
					tagTabContent += createTableRow(info.runnerTotal, 'Runner Total');
					tagTabContent += createTableRow(info.fielderRoll, "Fielder's Die (D6)");
					tagTabContent += createTableRow(info.fielderArm, "Fielder's Arm");
					tagTabContent += createTableRow(info.fielderTotal, 'Fielder Total');
					
					const resultColor = info.isOut ? '#f44336' : '#4CAF50';
					const resultText = info.isOut ? '❌ OUT' : '✓ SAFE';
					tagTabContent += `<tr style="background: ${resultColor}; color: white;"><td>RESULT</td><td style="font-weight: 600; font-size: 1.1em;">${resultText}</td></tr>`;
					
					if (index < tagUpResults.length - 1) {
						tagTabContent += `<tr style="background: #f5f5f5;"><td colspan="2" style="height: 8px;"></td></tr>`;
					}
				} else {
					// Runner doesn't have confidence
					tagTabContent += createTableRow(info.runner, 'Runner');
					tagTabContent += createTableRow(info.confidenceRoll, 'Confidence Die (D6)');
					tagTabContent += createTableRow(info.speed, "Runner's Speed");
					tagTabContent += createTableRow(info.confidence, 'Total Confidence', true);
					
					const resultColor = '#f44336';
					const resultText = '❌ NO CONFIDENCE';
					tagTabContent += `<tr style="background: ${resultColor}; color: white;"><td>DECISION</td><td style="font-weight: 600; font-size: 1.1em;">${resultText}</td></tr>`;
					
					if (index < tagUpResults.length - 1) {
						tagTabContent += `<tr style="background: #f5f5f5;"><td colspan="2" style="height: 8px;"></td></tr>`;
					}
				}
			});
			
			tagTabContent += closeTable();
			createTab('tag', 'TAG', tagTabContent, true);
		}
		
		updateBasesDisplay();
		updateScoreDisplay();
		updateOutsDisplay();
	}

	function performTagUpThrow(runnerName, currentBase, targetBase, fielderData, tagUpResults) {
		// Speed vs Arm test for tag up attempt
		const runnerPlayer = teamsData[battingTeamIndex].players.find(p => p.name === runnerName);
		const fieldingTeam = teamsData[pitchingTeamIndex];
		
		// Find the fielder playing the outfield position
		let fielderArm = fielderData.arm;
		const ofPlayer = fieldingTeam.players.find(p => 
			p.position === 'LF' || p.position === 'CF' || p.position === 'RF' ||
			p.secondaryPos === 'LF' || p.secondaryPos === 'CF' || p.secondaryPos === 'RF'
		);
		if (ofPlayer) {
			fielderArm = ofPlayer.arm;
		}
		
		// Both roll D6
		const fielderRoll = getRandomRoll(6, 'Tag Up Throw - Fielder Arm Die');
		const runnerRoll = getRandomRoll(6, runnerName + ' Tag Up Throw Die');
		
		// Calculate totals
		const fielderTotal = fielderRoll + fielderArm;
		const runnerTotal = runnerRoll + runnerPlayer.speed;
		
		// Defense wins ties
		const isOut = fielderTotal >= runnerTotal;
		
		if (isOut) {
			// Remove runner (they're out) and increment outs
			outs++;
			if (targetBase === 'home') {
				runners['3b'] = null;
			} else {
				runners['2b'] = null;
			}
		} else {
			// Advance runner
			if (targetBase === 'home') {
				// Runner scores
				teamScores.batting++;
				runners['3b'] = null;
			} else {
				// Runner advances to 3b
				runners['3b'] = runnerName;
				runners['2b'] = null;
			}
		}
		
		// Store throw result in tagUpResults for display
		const tagUpInfo = tagUpResults.find(info => info.runner === runnerName);
		if (tagUpInfo) {
			tagUpInfo.throwResult = true;
			tagUpInfo.runnerRoll = runnerRoll;
			tagUpInfo.runnerTotal = runnerTotal;
			tagUpInfo.fielderRoll = fielderRoll;
			tagUpInfo.fielderArm = fielderArm;
			tagUpInfo.fielderTotal = fielderTotal;
			tagUpInfo.isOut = isOut;
		}
		
		// Update display with throw result
		const resultText = isOut ? `TAG UP OUT at ${targetBase === 'home' ? 'HOME' : '3RD'}` : `TAG UP SAFE at ${targetBase === 'home' ? 'HOME' : '3RD'}`;
		document.getElementById('outcome-line2').textContent = resultText;
		document.getElementById('outcome-line2').style.display = 'block';
	}

	function handleCheck() {
		// Handle Score = D6 Roll + Fielder's Glove Stat
		const roll = getRandomRoll(6, 'Handle Check Die');
		const handleScore = roll + fielderData.glove;
		
		// Determine required score based on Batter Response Outcome
		const handleScoreNeeded = {
			'Dribbler': 4,
			'Can of Corn': 3,
			'Bloop': 5,
			'Screamer*': 6,
			'Laser': 7
		};
		
		const scoreNeeded = handleScoreNeeded[brOutcome] || 0;
		const handled = handleScore >= scoreNeeded;
		
		// Check if this is a catchable ball (automatic out)
		const catchableBalls = ['Can of Corn', 'Bloop', 'Laser'];
		const isCatchable = catchableBalls.includes(brOutcome);
		
		let result;
		if (handled) {
			result = 'Handled';
			// For catchable balls, check if runners can tag up
			if (isCatchable) {
				outs++;
				updateOutsDisplay();
				updateNextBatterButton();
				updateOutcomeDisplay('BATTER OUT - CAUGHT');
				const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
				logPlay(teamsData[battingTeamIndex].name, batter.name, `is caught by ${fielderData.name}`);
				
				// Show tag-up button if there are runners on 2b or 3b
				const tagUpButton = document.getElementById('tagUpButton');
				if ((runners['2b'] !== null || runners['3b'] !== null)) {
					tagUpButton.style.display = 'inline-block';
					tagUpButton.disabled = false;
				} else {
					tagUpButton.style.display = 'none';
					tagUpButton.disabled = true;
				}
			} else {
				// Ground ball is handled - don't add batter to first yet
				// The throw attempt will determine final base assignments
				// For non-ground balls, batter will be placed on base if safe on throw
			}
		} else {
			result = 'Not Handled - Single, Runners advance 1 base';
			// Advance existing runners one base, then add batter to 1B
			advanceRunners();
			addRunnerToBase('1b');
			updateBasesDisplay();
			populateRostersForTeams();
			updateScoreDisplay();
			const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
			logPlay(teamsData[battingTeamIndex].name, batter.name, `gets a hit to ${brOutcome.toLowerCase()}`);
			
			// Hide tag-up button for non-catchable balls
			const tagUpButton = document.getElementById('tagUpButton');
			tagUpButton.style.display = 'none';
			tagUpButton.disabled = true;
		}
		
		// Update fielder highlight color based on handle result
		updateFielderHighlightColor(handled);
		
		// Update outcome display with handle result
		const handleStatus = handled ? 'Handled' : 'Not handled';
		document.getElementById('outcome-line2').textContent = `${fielderData.name} - ${handleStatus}`;
		document.getElementById('outcome-line2').style.display = 'block';
		
		// Create tab content
		const tabContent = `${createTableHeader()}${createTableRow(roll, 'Handle Check Die (D6)')}${createTableRow(fielderData.glove, "Fielder's Glove Stat")}${createTableRow(handleScore, 'Total Handle Score', true)}${createTableRow(scoreNeeded, 'Score Needed')}${createTableRow(result === 'Handled' ? 'SUCCESS' : 'FAILURE', 'Handle Result', true)}${closeTable()}`;
		createTab('handle', 'HC', tabContent, true);
		
		// Show throw button if ball was handled and is NOT catchable (needs throw to base)
		if (handled && !isCatchable) {
			// Determine throw target: Ground balls with runners on base attempt double plays
			const isGroundBall = ['Dribbler', 'Screamer*'].includes(brOutcome);
			const runnerOnFirst = runners['1b'] !== null;
			const runnerOnSecond = runners['2b'] !== null;
			const runnerOnThird = runners['3b'] !== null;
			const canAttemptDoublePlay = outs < 2; // No DP if already 2 outs
			
			if (isGroundBall && runnerOnFirst && canAttemptDoublePlay) {
				// Determine the farthest forced base to throw to
				let firstThrowTarget = '2b'; // Default to second base
				
				// If bases are loaded (runners on 1B, 2B, 3B), throw to home (farthest forced)
				if (runnerOnFirst && runnerOnSecond && runnerOnThird) {
					firstThrowTarget = 'home';
				}
				// If runners on 1B and 2B, throw to 3B
				else if (runnerOnFirst && runnerOnSecond) {
					firstThrowTarget = '3b';
				}
				// Otherwise throw to 2B (just runner on 1B forces runner to 2B)
				
				throwTarget = firstThrowTarget;
				doublePlayAttempt = {
					phase: 'toSecond',
					primaryFielderCode: fielderData.code,
					runnerOnFirst: runners['1b'],
					batter: teamsData[battingTeamIndex].players[currentBatterIndex].name
				};
				document.getElementById('outcome-line3').textContent = 'Double Play Attempt!';
				document.getElementById('outcome-line3').style.display = 'block';
			} else {
				// No double play: throw to first base
				throwTarget = '1b';
				doublePlayAttempt = null;
				document.getElementById('outcome-line3').style.display = 'none';
			}
			
			// Flash the target base to show where the throw will go
			flashBase(throwTarget);
			
			// Create throw button if it doesn't exist
			let throwButton = document.getElementById('throwButton');
			if (!throwButton) {
				throwButton = document.createElement('button');
				throwButton.id = 'throwButton';
				throwButton.className = 'timeline-btn';
				throwButton.textContent = 'Throw';
				throwButton.addEventListener('click', throwAttempt);
				document.getElementById('timeline-buttons').appendChild(throwButton);
			}
			throwButton.disabled = false;
		} else {
			const throwButton = document.getElementById('throwButton');
			if (throwButton) throwButton.disabled = true;
		}
		
		// Disable the handle check button after it's been clicked
		document.getElementById('handleCheckButton').disabled = true;
	}

	function tagUp() {
		// Execute tag-up system for runners on 2nd or 3rd
		performTagUp(fielderData);
		
		// Hide tag-up button and disable it after clicking
		const tagUpButton = document.getElementById('tagUpButton');
		tagUpButton.disabled = true;
		tagUpButton.style.display = 'none';
	}

	function flashBase(baseName) {
		// Flash the target base to show where the throw is going
		const baseElement = document.getElementById(`runner-${baseName}`);
		if (baseElement) {
			// Remove the class if it exists to reset animation
			baseElement.classList.remove('base-flash');
			// Trigger reflow to restart animation
			void baseElement.offsetWidth;
			// Add the flash animation class (will stay until removed)
			baseElement.classList.add('base-flash');
		}
	}

	function stopFlashBase() {
		// Stop flashing on all bases
		const bases = ['1b', '2b', '3b'];
		bases.forEach(base => {
			const baseElement = document.getElementById(`runner-${base}`);
			if (baseElement) {
				baseElement.classList.remove('base-flash');
			}
		});
	}

	function throwAttempt() {
		// Disable throw button immediately to prevent multiple clicks
		const throwButton = document.getElementById('throwButton');
		if (throwButton) throwButton.disabled = true;
		
		// Speed vs Arm Test: Fielder's Arm vs Runner's Speed
		const pitcher = teamsData[pitchingTeamIndex].players[currentPitcherIndex];
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		
		// Fielder's arm stat
		let fielderArm = fielderData.arm || pitcher.arm;
		
		// For double play second throw (to first base), use the secondary fielder's arm with -1 debuff
		if (doublePlayAttempt && doublePlayAttempt.phase === 'toFirstDP') {
			// Determine secondary fielder based on primary fielder's position
			let secondaryFielderCode = '';
			const primaryCode = doublePlayAttempt.primaryFielderCode;
			
			if (primaryCode === '3B') {
				secondaryFielderCode = 'SS'; // SS covers 2nd, throws to 1B
			} else if (primaryCode === 'SS') {
				secondaryFielderCode = '2B'; // 2B covers 2nd, throws to 1B
			} else if (primaryCode === '2B') {
				secondaryFielderCode = 'SS'; // SS covers 2nd, throws to 1B
			} else if (primaryCode === '1B') {
				secondaryFielderCode = '2B'; // 2B covers 2nd, throws to 1B
			}
			
			// Get the secondary fielder's arm stat
			const pitchingTeam = teamsData[pitchingTeamIndex];
			if (pitchingTeam && secondaryFielderCode) {
				const secondaryFielder = pitchingTeam.players.find(p => p.position === secondaryFielderCode || p.secondaryPos === secondaryFielderCode);
				if (secondaryFielder) {
					fielderArm = Math.max(0, secondaryFielder.arm - 1); // Apply -1 debuff
				}
			}
		}
		
		// Determine runner and their speed based on throw target
		let runner, runnerSpeed, targetBaseDisplay, targetBase;
		
		if (doublePlayAttempt && doublePlayAttempt.phase === 'toSecond') {
			// First throw of DP: throw to first forced base (determined earlier)
			// Could be home, 3B, or 2B depending on base runners
			targetBase = throwTarget;
			
			// Determine which runner is being forced
			if (throwTarget === 'home') {
				// Runner from 3B forced to home
				runner = teamsData[battingTeamIndex].players.find(p => p.name === runners['3b']);
				runnerSpeed = runner ? runner.speed : 0;
				targetBaseDisplay = 'HOME';
			} else if (throwTarget === '3b') {
				// Runner from 2B forced to 3B
				runner = teamsData[battingTeamIndex].players.find(p => p.name === runners['2b']);
				runnerSpeed = runner ? runner.speed : 0;
				targetBaseDisplay = 'THIRD BASE';
			} else {
				// Runner from 1B forced to 2B
				runner = teamsData[battingTeamIndex].players.find(p => p.name === doublePlayAttempt.runnerOnFirst);
				runnerSpeed = runner ? runner.speed : 0;
				targetBaseDisplay = 'SECOND BASE';
			}
		} else if (doublePlayAttempt && doublePlayAttempt.phase === 'toFirstDP') {
			// Second throw of DP: throw to first base to get batter
			targetBase = '1b';
			runnerSpeed = batter.speed;
			targetBaseDisplay = 'FIRST BASE';
		} else {
			// Regular throw to first base
			targetBase = '1b';
			runnerSpeed = batter.speed;
			targetBaseDisplay = 'FIRST BASE';
		}
		
		// Both roll D6
		const fielderRoll = getRandomRoll(6, `Throw Attempt - Fielder Arm Die (to ${targetBaseDisplay})`);
		const runnerRoll = getRandomRoll(6, `Throw Attempt - Runner Speed Die (to ${targetBaseDisplay})`);
		
		// Calculate totals: fielder's roll + arm vs runner's roll + speed
		const fielderTotal = fielderRoll + fielderArm;
		const runnerTotal = runnerRoll + runnerSpeed;
		
		// Defense wins ties
		const isOut = fielderTotal >= runnerTotal;
		
		let result;
		let dpResult = null;
		
		if (doublePlayAttempt && doublePlayAttempt.phase === 'toSecond') {
			// First throw of DP attempt
			if (isOut) {
				// Determine result message based on throw target
				let resultMessage = `OUT at ${targetBaseDisplay}`;
				let runnerBase = '1b';
				
				if (throwTarget === 'home') {
					resultMessage = `OUT at HOME - Runner from 3rd is out`;
					runnerBase = '3b';
				} else if (throwTarget === '3b') {
					resultMessage = `OUT at THIRD - Runner from 2nd is out`;
					runnerBase = '2b';
				} else {
					resultMessage = `OUT at SECOND - Runner from 1st is out`;
					runnerBase = '1b';
				}
				
				result = resultMessage;
				dpResult = { firstThrow: true, isOut: true };
				
				// Remove runner from base (they're out)
				runners[runnerBase] = null;
				
				// If runner on base closer to batter, advance them to the base where the out was made
				if (throwTarget === 'home' && runners['2b']) {
					runners['3b'] = runners['2b'];
					runners['2b'] = null;
				} else if (throwTarget === '3b' && runners['1b']) {
					runners['2b'] = runners['1b'];
					runners['1b'] = null;
				} else if (throwTarget === '2b' && runners['1b']) {
					runners['1b'] = null; // Already handled above
				}
				
				// Now attempt second throw to first base for batter
				doublePlayAttempt.phase = 'toFirstDP';
				doublePlayAttempt.firstThrowSuccess = true;
				
				// Create HTML for first throw result before second throw
				const firstThrowContent = `
					<div style="display: flex; gap: 4px; font-size: 1.1em; background: #f0f8ff; padding: 4px; border-radius: 4px; line-height: 1;">
						<div style="flex: 1; border-right: 2px solid #0d47a1; padding-right: 4px;">
							<div style="font-weight: 700; color: #0d47a1; text-align: center; margin-bottom: 1px;">RUNNER ON 1B</div>
							<div style="margin: 0;"><span style="font-weight: 600;">D6:</span> ${runnerRoll}</div>
							<div style="margin: 0;"><span style="font-weight: 600;">Speed:</span> ${runnerSpeed}</div>
							<div style="font-weight: 700; color: #1565C0; border-top: 1px solid #0d47a1; margin-top: 1px; padding-top: 1px;">Total: ${runnerTotal}</div>
						</div>
						<div style="flex: 1; padding-left: 4px;">
							<div style="font-weight: 700; color: #0d47a1; text-align: center; margin-bottom: 1px;">FIELDER</div>
							<div style="margin: 0;"><span style="font-weight: 600;">D6:</span> ${fielderRoll}</div>
							<div style="margin: 0;"><span style="font-weight: 600;">Arm:</span> ${fielderArm}</div>
							<div style="font-weight: 700; color: #1565C0; border-top: 1px solid #0d47a1; margin-top: 1px; padding-top: 1px;">Total: ${fielderTotal}</div>
						</div>
					</div>
					<div style="margin-top: 8px; padding: 8px; background: #e8f5e9; border-left: 4px solid #2e7d32; font-weight: 600; color: #2e7d32;">
						OUT at Second - Attempting second throw to first...
					</div>
				`;
				
				createTab('throw', 'THROW 1', firstThrowContent, true);
				
				// Show second throw button
				let throwButton = document.getElementById('throwButton');
				if (!throwButton) {
					throwButton = document.createElement('button');
					throwButton.id = 'throwButton';
					throwButton.className = 'timeline-btn';
					throwButton.textContent = 'Second Throw';
					throwButton.addEventListener('click', throwAttempt);
					document.getElementById('timeline-buttons').appendChild(throwButton);
				}
				throwButton.disabled = false;
				throwButton.textContent = 'Second Throw';
				updateBasesDisplay();
				updateScoreDisplay();
				
				// Move the flash highlight from 2B to 1B for the second throw
				stopFlashBase();
				flashBase('1b');
				
				return; // Exit here, second throw will be called separately
			} else {
				result = `SAFE at SECOND - Runner reaches second base`;
				dpResult = { firstThrow: true, isOut: false };
				
				// Runner is safe at second, so double play fails
				runners['2b'] = runners['1b'];
				runners['1b'] = batter.name;
				
				updateOutcomeDisplay('SAFE - DOUBLE PLAY AVERTED');
				doublePlayAttempt = null;
			}
		} else if (doublePlayAttempt && doublePlayAttempt.phase === 'toFirstDP') {
			// Second throw of DP attempt
			if (isOut) {
				result = `OUT at FIRST - DOUBLE PLAY!`;
				dpResult = { secondThrow: true, isOut: true };
				
				// Both runners are out - the one who was on first is already out (we removed from runners['1b'])
				// and now the batter is out
				runners['1b'] = null;
				outs += 2;
				updateOutsDisplay();
				updateNextBatterButton();
				updateOutcomeDisplay('DOUBLE PLAY!');
			} else {
				result = `SAFE at FIRST - Batter reaches first`;
				dpResult = { secondThrow: true, isOut: false };
				
				// Batter is safe at first
				runners['1b'] = batter.name;
				// Runner who was on first is already out, so just 1 out
				outs++;
				updateOutsDisplay();
				updateNextBatterButton();
				updateOutcomeDisplay('SAFE - ONE OUT, DOUBLE PLAY FAILS');
			}
			doublePlayAttempt = null;
		} else {
			// Regular single throw to first base
			if (isOut) {
				result = 'OUT - Thrown out at first base';
				// Batter is out
				runners['1b'] = null;
				outs++;
				updateOutsDisplay();
				updateNextBatterButton();
				updateOutcomeDisplay('OUT - THROWN OUT');
			} else {
				result = 'SAFE - Runner reaches first base';
				runners['1b'] = batter.name;
				updateOutcomeDisplay('SAFE - RUNNER REACHES');
			}
		}
		
		updateBasesDisplay();
		updateScoreDisplay();
		
		// Create tab content for throw attempt with side-by-side layout
		const tabContent = `
			<div style="display: flex; gap: 4px; font-size: 1.1em; background: #f0f8ff; padding: 4px; border-radius: 4px; line-height: 1;">
				<div style="flex: 1; border-right: 2px solid #0d47a1; padding-right: 4px;">
					<div style="font-weight: 700; color: #0d47a1; text-align: center; margin-bottom: 1px;">RUNNER</div>
					<div style="margin: 0;"><span style="font-weight: 600;">D6:</span> ${runnerRoll}</div>
					<div style="margin: 0;"><span style="font-weight: 600;">Speed:</span> ${runnerSpeed}</div>
					<div style="font-weight: 700; color: #1565C0; border-top: 1px solid #0d47a1; margin-top: 1px; padding-top: 1px;">Total: ${runnerTotal}</div>
				</div>
				<div style="flex: 1; padding-left: 4px;">
					<div style="font-weight: 700; color: #0d47a1; text-align: center; margin-bottom: 1px;">FIELDER</div>
					<div style="margin: 0;"><span style="font-weight: 600;">D6:</span> ${fielderRoll}</div>
					<div style="margin: 0;"><span style="font-weight: 600;">Arm:</span> ${fielderArm}${doublePlayAttempt && doublePlayAttempt.phase === 'toFirstDP' ? ' (-1 DP debuff)' : ''}</div>
					<div style="font-weight: 700; color: #1565C0; border-top: 1px solid #0d47a1; margin-top: 1px; padding-top: 1px;">Total: ${fielderTotal}</div>
				</div>
			</div>
		`;
		createTab('throw', 'THROW', tabContent, true);
		
		// Stop the base flash now that throw is complete
		stopFlashBase();
	}

	function startBatterResponse() {
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		const pitcher = teamsData[pitchingTeamIndex].players[currentPitcherIndex];
		const roll = getRandomRoll(12, 'Batter Response Die');
		
		// Special rule: Nat 1 is always strikeout swinging
		if (roll === 1) {
			// Update outcome display above zone
			updateOutcomeDisplay('STRIKEOUT SWINGING - OUT');
			
			// Create tab for result
			let brChart = `${createTableHeader()}${createTableRow(roll, 'D12 Roll (Natural 1)')}${closeTable()}`;
			createTab('br', 'BR', brChart, true);
			
			// Increment outs
			outs++;
			updateOutsDisplay();
			updateNextBatterButton();
			const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
			logPlay(teamsData[battingTeamIndex].name, batter.name, 'strikes out swinging');
			
			// Disable the batter response button after it's been clicked
			document.getElementById('batterResponseButton').disabled = true;
			return;
		}
		
		// Calculate BR: D12 - Velocity + Contact + PD Modifier, then add Power if result >= 9
		const subtotal = roll - pitcher.velocity + batter.contact + pdModifier;
		const total = subtotal >= 9 ? subtotal + batter.power : subtotal;
		
		let outcome, parentOutcome;
		if (total <= 3) {
			outcome = "SO Swinging";
			parentOutcome = "Strikeout";
		} else if (total <= 5) {
			outcome = "Dribbler";
			parentOutcome = "Ground Ball";
		} else if (total === 6) {
			outcome = "Can of Corn";
			parentOutcome = "Pop Up";
		} else if (total <= 8) {
			outcome = "Bloop";
			parentOutcome = "Line Drive";
		} else if (total <= 10) {
			outcome = "Screamer*";
			parentOutcome = "Ground Ball";
		} else if (total === 11) {
			outcome = "Laser";
			parentOutcome = "Line Drive";
		} else {
			outcome = "Moonshot";
			parentOutcome = "Home Run";
		}
		
		const powerDisplay = subtotal >= 9 ? ` +<br>+${batter.power} Power` : '';
		let pdDisplay = '';
		if (pdModifier === 1) {
			pdDisplay = ` +<br>+1 Down the Middle Mod`;
		} else if (pdModifier === -1) {
			pdDisplay = ` +<br>-1 Painted Mod`;
		}

		
		// Store outcome and show Determine Fielder button if ball is in play (4-11)
		brOutcome = outcome;
		
		// Determine play type for display summary
		let brPlayType = '';
		if (total >= 12) {
			brPlayType = 'HOME RUN';
			updateOutcomeDisplay(`${outcome} - ${brPlayType}`);
		} else if (total <= 3) {
			brPlayType = 'OUT';
			updateOutcomeDisplay(`${outcome} - ${brPlayType}`);
			// Increment outs for strikeout
			outs++;
			updateOutsDisplay();
			updateNextBatterButton();
			const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
			logPlay(teamsData[battingTeamIndex].name, batter.name, 'strikes out swinging');
		} else if (total >= 4 && total <= 11) {
			brPlayType = 'IN PLAY';
			updateOutcomeDisplay(`${outcome} - ${brPlayType}`);
		}
		
		if (total >= 4 && total <= 11) {
			document.getElementById('determineFielderButton').disabled = false;
		} else {
			document.getElementById('determineFielderButton').disabled = true;
		}
		
		// Handle home run (Moonshot - total >= 12)
		if (total >= 12) {
			// Home run: advance all runners and batter scores immediately (not on base)
			advanceRunnersMultipleBases(4);
			updateBasesDisplay();
			updateScoreDisplay();
			const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
			logPlay(teamsData[battingTeamIndex].name, batter.name, 'hits a HOME RUN!');
		}
		
		// Disable the batter response button after it's been clicked
		document.getElementById('batterResponseButton').disabled = true;
		
		// Update tab for Batter Response
		let brChart = `${createTableHeader()}${createTableRow(roll, 'D12 Roll')}${createTableRow(pitcher.velocity, "Pitcher's Velocity Stat")}${createTableRow(batter.contact, "Batter's Contact Stat")}`;
		
		if (pdModifier === 1) {
			brChart += `${createTableRow('+1', 'Down the Middle Bonus')}`;
		} else if (pdModifier === -1) {
			brChart += `${createTableRow('-1', 'Painted Penalty')}`;
		}
		
		if (subtotal >= 9) {
			brChart += `${createTableRow(batter.power, "Batter's Power Stat")}`;
		}
		
		brChart += `${createTableRow(total, 'Total Result', true)}${closeTable()}`;
		createTab('br', 'BR', brChart, true);
	}

	function startPitcherDelivery() {
		if (pitchingTeamIndex === '' || battingTeamIndex === '' || currentPitcherIndex === -1 || currentBatterIndex === -1) {
			alert('Please select teams and a pitcher and batter.');
			return;
		}
		const pitcher = teamsData[pitchingTeamIndex].players[currentPitcherIndex];
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		const roll = getRandomRoll(20, 'Pitcher Delivery Die');
		const modifier = pitcher.control - batter.eye;
		const total = roll + modifier;
		let outcome;
		if (total <= 2) outcome = "Wild Pitch";
		else if (total <= 4) outcome = "BB";
		else if (total <= 11) outcome = "Down the Middle (+1 to BR)";
		else if (total <= 15) outcome = "On the Plate";
		else if (total <= 19) outcome = "Paint (-1 to BR)";
		else outcome = "Strikeout Looking";		
		// Set PD modifier for Batter Response
		if (total <= 11 && total >= 5) {
			pdModifier = 1;
		} else if (total >= 16 && total <= 19) {
			pdModifier = -1;
		} else {
			pdModifier = 0;
		}
		
		// Position baseball based on outcome
		let outcomeAbbr, posX, posY, line1, line2;
		if (total <= 2) {
			outcomeAbbr = 'WP';
			// Random position far outside the zone
			const wpSide = Math.floor(Math.random() * 4);
			if (wpSide === 0) {
				// Top outside
				posX = Math.random() * 200 - 100;
				posY = -150;
			} else if (wpSide === 1) {
				// Bottom outside
				posX = Math.random() * 200 - 100;
				posY = 150;
			} else if (wpSide === 2) {
				// Left outside
				posX = -150;
				posY = Math.random() * 200 - 100;
			} else {
				// Right outside
				posX = 150;
				posY = Math.random() * 200 - 100;
			}
			line1 = 'Wild Pitch';
			line2 = 'or a walk if bases are empty.';
		} else if (total <= 4) {
			outcomeAbbr = 'BB';
			// Random position outside the zone
			const bbSide = Math.floor(Math.random() * 4);
			if (bbSide === 0) {
				// Top outside
				posX = Math.random() * 200 - 100;
				posY = -150;
			} else if (bbSide === 1) {
				// Bottom outside
				posX = Math.random() * 200 - 100;
				posY = 150;
			} else if (bbSide === 2) {
				// Left outside
				posX = -150;
				posY = Math.random() * 200 - 100;
			} else {
				// Right outside
				posX = 150;
				posY = Math.random() * 200 - 100;
			}
			line1 = 'Walk';
			line2 = '';
		} else if (total <= 11) {
			outcomeAbbr = 'MIDDLE';
			posX = 0; // Center
			posY = 0;
			line1 = 'Down the Middle';
			line2 = '+1 to Batter Response';
		} else if (total <= 15) {
			outcomeAbbr = 'ON PLATE';
			// Random position between middle and edge (inner zone)
			// Zone is 160px wide (-80 to +80) and 240px tall (-120 to +120)
			// Inner range: -50 to +50 horizontally, -75 to +75 vertically
			posX = Math.random() * 100 - 50;
			posY = Math.random() * 150 - 75;
			line1 = 'On the Plate';
			line2 = '';
		} else if (total <= 19) {
			outcomeAbbr = 'PAINT';
			// Random position on the black (edge) of the zone
			// Zone is 160px wide (-80 to +80) and 240px tall (-120 to +120)
			const side = Math.floor(Math.random() * 4); // 0=top, 1=bottom, 2=left, 3=right
			if (side === 0) {
				// Top edge
				posX = Math.random() * 160 - 80;
				posY = -120;
			} else if (side === 1) {
				// Bottom edge
				posX = Math.random() * 160 - 80;
				posY = 120;
			} else if (side === 2) {
				// Left edge
				posX = -80;
				posY = Math.random() * 240 - 120;
			} else {
				// Right edge
				posX = 80;
				posY = Math.random() * 240 - 120;
			}
			line1 = 'Painted';
			line2 = '-1 to Batter Response';
		} else {
			outcomeAbbr = 'SO LOOK';
			posX = 0;
			posY = -60; // High and outside
			line1 = 'Strikeout Looking';
			line2 = '';
		}
		
		const baseball = document.getElementById('pitch-baseball');
		baseball.innerHTML = `${total}`;
		baseball.style.left = `calc(50% + ${posX}px)`;
		baseball.style.top = `calc(50% + ${posY}px)`;
		baseball.style.transform = 'translate(-50%, -50%)';
		baseball.classList.add('show');
		
		// Handle Wild Pitch
		let wildPitchWithRunners = false;
		if (outcome === 'Wild Pitch') {
			wildPitchWithRunners = hasRunners();
			if (wildPitchWithRunners) {
				// Runners on base: advance them and allow another pitch
				advanceRunners();
				updateBasesDisplay();
				populateRostersForTeams();
				updateScoreDisplay();
				// Re-enable pitcher delivery button to pitch again (only case where this happens)
				document.getElementById('startButton').disabled = false;
			} else {
				// No runners: it's a walk
				addRunnerToBase('1b');
				updateBasesDisplay();
				populateRostersForTeams();
			}
		} else if (outcome === 'Ball' || outcome === 'BB') {
			// Walk: advance runners only if forced (existing baserunners advance only if there are runners behind them)
			if (hasRunners()) {
				advanceRunnersOnWalk();
			}
			addRunnerToBase('1b');
			updateBasesDisplay();
			populateRostersForTeams();
			updateScoreDisplay();
			const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
			logPlay(teamsData[battingTeamIndex].name, batter.name, 'walks');
		}
		
		// Display outcome lines above zone
		let outcomeSummary = '';
		if (outcome === 'Wild Pitch') {
			outcomeSummary = (runners['2b'] !== null || runners['3b'] !== null) ? 'WILD PITCH - NEXT PITCH' : 'WILD PITCH - NEXT BATTER';
		} else if (outcome === 'Ball' || outcome === 'BB') {
			outcomeSummary = 'WALK';
		} else if (outcome === 'Strikeout Looking') {
			outcomeSummary = 'STRIKEOUT LOOKING - OUT';
		} else if (outcome === 'Down the Middle (+1 to BR)') {
			outcomeSummary = 'DOWN THE MIDDLE - IN PLAY';
		} else if (outcome === 'On the Plate') {
			outcomeSummary = 'ON THE PLATE - IN PLAY';
		} else if (outcome === 'Paint (-1 to BR)') {
			outcomeSummary = 'PAINTED - IN PLAY';
		}
		updateOutcomeDisplay(outcomeSummary);

		if (total >= 5 && total <= 19) {
			document.getElementById('batterResponseButton').disabled = false;
		} else {
			document.getElementById('batterResponseButton').disabled = true;
		}
		
		// Handle Strikeout Looking - increment outs
		if (outcome === 'Strikeout Looking') {
			outs++;
			updateOutsDisplay();
			updateNextBatterButton();
			document.getElementById('batterResponseButton').disabled = true;
			const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
			logPlay(teamsData[battingTeamIndex].name, batter.name, 'strikes out looking');
		}
		
		// Disable the start button after it's been clicked, unless it's a wild pitch with runners
		// (in which case it was re-enabled above to allow another pitch)
		if (!(outcome === 'Wild Pitch' && wildPitchWithRunners)) {
			document.getElementById('startButton').disabled = true;
		}
		
		// Update tab for Pitcher Delivery
		const pdChart = `${createTableHeader()}${createTableRow(roll, 'Pitcher Delivery D20 Roll')}${createTableRow(batter.eye, "Batter's Eye Stat")}${createTableRow(pitcher.control, "Pitcher's Control Stat")}${createTableRow(total, 'Total Result', true)}${closeTable()}`;
		createTab('pd', 'PD', pdChart, true);
	}

    // attach event listeners after DOM is loaded
	document.addEventListener('DOMContentLoaded', function () {
		// Ensure manual rolls starts disabled
		const manualSwitch = document.getElementById('manualRollSwitch');
		if (manualSwitch) {
			manualSwitch.checked = false;
			useManualRolls = false;
		}
		
		// Default data
		teamsData = [
			{
				name: "Rat Stack",
				players: [
					{ battingOrder: 1, number: 16, name: "Donezo", position: "SS", secondaryPos: "P", contact: 2, power: 0, eye: 1, speed: 3, control: 2, velocity: 1, stamina: 8, arm: 2, glove: 1 },
					{ battingOrder: 2, number: 2, name: "GBR", position: "P", secondaryPos: "INF", contact: 1, power: 2, eye: 1, speed: 1, control: 1, velocity: 3, stamina: 12, arm: 1, glove: 2 },
					{ battingOrder: 3, number: 5, name: "EFive", position: "2B", secondaryPos: "", contact: 3, power: 2, eye: 0, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 1 },
					{ battingOrder: 4, number: 67, name: "Girble", position: "C", secondaryPos: "", contact: 2, power: 1, eye: 2, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 0 },
					{ battingOrder: 5, number: 8, name: "Cazanovi", position: "RF", secondaryPos: "", contact: 1, power: 0, eye: 1, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 2, glove: 2 },
					{ battingOrder: 6, number: 34, name: "Mira", position: "CF", secondaryPos: "", contact: 1, power: 1, eye: 0, speed: 2, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 2 },
					{ battingOrder: 7, number: 26, name: "Iron", position: "1B", secondaryPos: "", contact: 0, power: 2, eye: 2, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 1 },
					{ battingOrder: 8, number: "", name: "Big Noey", position: "3B", secondaryPos: "P", contact: 1, power: 1, eye: 3, speed: 1, control: 2, velocity: 1, stamina: 8, arm: 1, glove: 1 },
					{ battingOrder: 9, number: 9, name: "Osaj", position: "LF", secondaryPos: "", contact: 0, power: 3, eye: 0, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 3, glove: 1 }
				]
			},
			{
				name: "Content Kings",
				players: [
					{ battingOrder: 1, number: 0, name: "Super", position: "CF", secondaryPos: "", contact: 1, power: 0, eye: 0, speed: 3, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 2 },
					{ battingOrder: 2, number: 0, name: "Frost", position: "3B", secondaryPos: "", contact: 1, power: 1, eye: 1, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 0, glove: 2 },
					{ battingOrder: 3, number: 3, name: "Griffin", position: "P", secondaryPos: "", contact: 0, power: 2, eye: 1, speed: 1, control: 1, velocity: 3, stamina: 12, arm: 2, glove: 1 },
					{ battingOrder: 4, number: 33, name: "Lion", position: "SS", secondaryPos: "P", contact: 1, power: 1, eye: 2, speed: 0, control: 2, velocity: 2, stamina: 6, arm: 1, glove: 2 },
					{ battingOrder: 5, number: 1, name: "Justin", position: "RF", secondaryPos: "", contact: 0, power: 3, eye: 0, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 3, glove: 0 },
					{ battingOrder: 6, number: 2, name: "Travis", position: "LF", secondaryPos: "", contact: 1, power: 2, eye: 0, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 3, glove: 0 },
					{ battingOrder: 7, number: 0, name: "Aspen", position: "1B", secondaryPos: "P", contact: 2, power: 1, eye: 0, speed: 1, control: 3, velocity: 1, stamina: 12, arm: 1, glove: 2 },
					{ battingOrder: 8, number: 0, name: "Bailey", position: "2B", secondaryPos: "", contact: 0, power: 1, eye: 2, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 2, glove: 2 },
					{ battingOrder: 9, number: 0, name: "Rose", position: "C", secondaryPos: "", contact: 0, power: 1, eye: 3, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 1 }
				]
			},
			{
				name: "Nine-Lives Nine",
				players: [
					{ battingOrder: 1, number: 0, name: "Bunny", position: "2B", secondaryPos: "", contact: 1, power: 0, eye: 0, speed: 3, control: 0, velocity: 0, stamina: 0, arm: 3, glove: 2 },
					{ battingOrder: 2, number: 0, name: "Beni", position: "CF", secondaryPos: "P", contact: 1, power: 0, eye: 1, speed: 2, control: 3, velocity: 1, stamina: 8, arm: 2, glove: 1 },
					{ battingOrder: 3, number: 0, name: "Oliver", position: "P", secondaryPos: "INF", contact: 1, power: 0, eye: 1, speed: 1, control: 0, velocity: 4, stamina: 8, arm: 1, glove: 3 },
					{ battingOrder: 4, number: 0, name: "Boba", position: "C", secondaryPos: "", contact: 0, power: 2, eye: 0, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 2 },
					{ battingOrder: 5, number: 0, name: "Fizzy", position: "SS", secondaryPos: "P", contact: 2, power: 0, eye: 0, speed: 2, control: 2, velocity: 2, stamina: 10, arm: 0, glove: 2 },
					{ battingOrder: 6, number: 0, name: "Garfield", position: "1B", secondaryPos: "", contact: 1, power: 2, eye: 3, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 0, glove: 0 },
					{ battingOrder: 7, number: 0, name: "Cleo", position: "LF", secondaryPos: "", contact: 1, power: 1, eye: 1, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 0, glove: 2 },
					{ battingOrder: 8, number: 0, name: "Twit", position: "RF", secondaryPos: "", contact: 1, power: 0, eye: 2, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 2, glove: 1 },
					{ battingOrder: 9, number: 0, name: "Dio", position: "3B", secondaryPos: "", contact: 1, power: 1, eye: 2, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 2, glove: 2 }
				]
			},
			{
				name: "Straw Hat Pirates",
				players: [
					{ battingOrder: 1, number: 0, name: "Vivi", position: "CF", secondaryPos: "", contact: 2, power: 1, eye: 1, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 0 },
					{ battingOrder: 2, number: 0, name: "Usopp", position: "RF", secondaryPos: "", contact: 1, power: 1, eye: 1, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 2, glove: 0 },
					{ battingOrder: 3, number: 0, name: "Luffy", position: "SS", secondaryPos: "P", contact: 2, power: 1, eye: 0, speed: 1, control: 1, velocity: 2, stamina: 14, arm: 3, glove: 1 },
					{ battingOrder: 4, number: 0, name: "Zoro", position: "2B", secondaryPos: "P", contact: 0, power: 3, eye: 1, speed: 0, control: 1, velocity: 3, stamina: 14, arm: 1, glove: 2 },
					{ battingOrder: 5, number: 0, name: "Robin", position: "1B", secondaryPos: "", contact: 2, power: 0, eye: 3, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 1, glove: 2 },
					{ battingOrder: 6, number: 0, name: "Sanji", position: "3B", secondaryPos: "", contact: 1, power: 0, eye: 2, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 0, glove: 2 },
					{ battingOrder: 7, number: 0, name: "Franky", position: "C", secondaryPos: "", contact: 0, power: 4, eye: 0, speed: 0, control: 0, velocity: 0, stamina: 0, arm: 2, glove: 2 },
					{ battingOrder: 8, number: 0, name: "Chopper", position: "LF", secondaryPos: "", contact: 1, power: 1, eye: 1, speed: 1, control: 0, velocity: 0, stamina: 0, arm: 3, glove: 2 },
					{ battingOrder: 9, number: 0, name: "Nami", position: "P", secondaryPos: "", contact: 0, power: 0, eye: 2, speed: 3, control: 3, velocity: 1, stamina: 12, arm: 1, glove: 1 }
				]
			}
		];
		populateTeamSelects();

		document.getElementById('pitchingTeamSelect').addEventListener('change', onPitchingTeamChange);
		document.getElementById('battingTeamSelect').addEventListener('change', onBattingTeamChange);
		document.getElementById('pitchingTeamSelect').addEventListener('change', onPitchingTeamChange);
		document.getElementById('battingTeamSelect').addEventListener('change', onBattingTeamChange);
		document.getElementById('pitcherSelect').addEventListener('change', onPitcherSelectChange);
		document.getElementById('pitcherSelect').addEventListener('change', clearResults);
		document.getElementById('batterSelect').addEventListener('change', onBatterSelectChange);
		document.getElementById('batterSelect').addEventListener('change', clearResults);
		document.getElementById('startButton').addEventListener('click', startPitcherDelivery);
		document.getElementById('batterResponseButton').addEventListener('click', startBatterResponse);
		document.getElementById('determineFielderButton').addEventListener('click', determineFielder);
		document.getElementById('handleCheckButton').addEventListener('click', handleCheck);
		document.getElementById('tagUpButton').addEventListener('click', tagUp);
		document.getElementById('nextBatterButton').addEventListener('click', nextBatter);
		document.getElementById('manualRollSwitch').addEventListener('change', function() {
			useManualRolls = this.checked;
		});

		// Expose functions globally for onclick handlers in HTML
		window.setCurrentPitcherGlobal = setCurrentPitcher;
		window.setCurrentBatterGlobal = setCurrentBatter;

		// Initialize bases and score display
		updateBasesDisplay();
		updateScoreDisplay();
	});
})();

