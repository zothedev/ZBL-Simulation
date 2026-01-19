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

	function updateBasesDisplay() {
		// Update the bases display with runner names
		const bases = ['1b', '2b', '3b'];
		bases.forEach(base => {
			const element = document.getElementById(`runner-${base}`);
			if (element) {
				if (runners[base]) {
					element.textContent = runners[base];
					element.classList.add('occupied');
				} else {
					element.textContent = '-';
					element.classList.remove('occupied');
				}
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
		
		// Find the player with this position
		const fielder = team.players.find(p => p.position === fielderPosition || p.secondaryPos === fielderPosition);
		if (!fielder) return;
		
		// Find their index in the roster
		const fielderIndex = team.players.indexOf(fielder);
		if (fielderIndex === -1) return;
		
		// Highlight their player box in the left roster with specified color
		const rosterItems = document.querySelectorAll('#left-roster-list .roster-item');
		rosterItems.forEach((item, index) => {
			if (index === fielderIndex) {
				item.classList.remove('fielding-highlight-yellow', 'fielding-highlight-red', 'fielding-highlight-green');
				item.classList.add(`fielding-highlight-${color}`);
			} else {
				item.classList.remove('fielding-highlight-yellow', 'fielding-highlight-red', 'fielding-highlight-green');
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
		updateRosterHighlight();
		updateZoneDisplay();
	}

	function setCurrentBatter(playerIndex) {
		currentBatterIndex = parseInt(playerIndex);
		updateRosterHighlight();
		updateZoneDisplay();
	}

	function populateRostersForTeams() {
		const leftRoster = document.getElementById('left-roster-list');
		const rightRoster = document.getElementById('right-roster-list');
		
		leftRoster.innerHTML = '';
		rightRoster.innerHTML = '';
		
		// Populate left roster (pitching team)
		if (pitchingTeamIndex !== '') {
			const pitchingTeam = teamsData[pitchingTeamIndex];
			pitchingTeam.players.forEach((player, index) => {
				const rosterItem = document.createElement('div');
				rosterItem.className = 'roster-item';
				rosterItem.innerHTML = `
					<span class="roster-item-name">${player.name}</span>
					<span class="roster-item-position">${player.position}</span>
				`;
				leftRoster.appendChild(rosterItem);
			});
		}
		
		// Populate right roster (batting team)
		if (battingTeamIndex !== '') {
			const battingTeam = teamsData[battingTeamIndex];
			battingTeam.players.forEach((player, index) => {
				const rosterItem = document.createElement('div');
				rosterItem.className = 'roster-item';
				rosterItem.innerHTML = `
					<span class="roster-item-name">${player.name}</span>
					<span class="roster-item-position">${player.position}</span>
				`;
				rightRoster.appendChild(rosterItem);
			});
		}
		
		updateRosterHighlight();
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
	}

	function addRunnerToBase(baseName) {
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		runners[baseName] = batter.name;
	}

	function advanceRunners() {
		// Move runners forward one base: 3B→score, 2B→3B, 1B→2B
		// Use temporary variables to avoid overwriting during sequential operations
		const runner3b = runners['3b'];
		const runner2b = runners['2b'];
		const runner1b = runners['1b'];
		
		// Runner on 3B scores
		if (runner3b) {
			teamScores.batting++;
		}
		
		// Advance remaining runners
		runners['3b'] = runner2b || null;
		runners['2b'] = runner1b || null;
		runners['1b'] = null;
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
		let new1b = null;
		let new2b = null;
		let new3b = null;
		
		// 1B runner always advances to 2B (batter is coming to 1B)
		if (runner1b) {
			new2b = runner1b;
		}
		
		// 2B runner advances to 3B only if 1B is occupied (forced chain)
		if (runner2b && runner1b) {
			new3b = runner2b;
		} else {
			// 2B runner stays if not forced
			new3b = runner2b;
		}
		
		// 3B runner scores only if all bases are loaded (full forced chain)
		if (runner3b && runner2b && runner1b) {
			teamScores.batting++;
		} else {
			// 3B runner stays if not part of a full forced advance
			// But if 2B is being forced into 3B, then 3B must move somewhere (score or stay)
			// In forced advance scenario, 3B would score. Otherwise stay.
			new3b = runner2b && runner1b ? runner2b : runner3b;
		}
		
		runners['1b'] = new1b;
		runners['2b'] = new2b;
		runners['3b'] = new3b;
	}

	function hasRunners() {
		// Check if any runners are on base
		return runners['1b'] !== null || runners['2b'] !== null || runners['3b'] !== null;
	}

	function advanceRunnersMultipleBases(bases) {
		// Advance runners by specified number of bases (1 for single, 4 for home run)
		// Track which runners score - score goes to batting team
		
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
			}
			if (runners['1b']) {
				runners['2b'] = runners['1b'];
				runners['1b'] = null;
			}
		}
	}

	function determineFielder() {
		let fielderType;
		switch(brOutcome) {
			case 'Dribbler*':
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
			const roll = Math.floor(Math.random() * 20) + 1;
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
			tabContent = `${createTableHeader()}${createTableRow('', brOutcome)}${createTableRow(roll, 'Infielder Selection Die (D20)')}${createTableRow('', fielderName, true)}${closeTable()}`;
		} else if (fielderType === 'OF') {
			const roll = Math.floor(Math.random() * 6) + 1;
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
			tabContent = `${createTableHeader()}${createTableRow('', brOutcome)}${createTableRow(roll, 'Outfielder Selection Die (D6)')}${createTableRow('', fielderName, true)}${closeTable()}`;
		}
		
		// Get fielder's glove stat from player data
		const pitcher = document.getElementById('pitcher-name').textContent;
		const batter = document.getElementById('batter-name').textContent;
		const selectedTeam = teamsData.find(t => t.players.some(p => p.name === pitcher || p.name === batter));
		if (selectedTeam && fielderName) {
			const fielder = selectedTeam.players.find(p => p.name === fielderName);
			gloveStat = fielder ? fielder.glove : 0;
		}
		
		// Store fielder data for handle check
		fielderData = {
			name: fielderName,
			code: fielderCode,
			glove: gloveStat
		};
		
		// Create Fielder tab if content exists
		if (tabContent) {
			createTab('fielder', 'DF', tabContent, true);
			// Highlight the fielder in the roster
			highlightFielder(fielderCode);
			// Enable handle check button
			document.getElementById('handleCheckButton').disabled = false;
			// Disable the determine fielder button after it's been clicked
			document.getElementById('determineFielderButton').disabled = true;
		}
	}

	function handleCheck() {
		// Handle Score = D6 Roll + Fielder's Glove Stat
		const roll = Math.floor(Math.random() * 6) + 1;
		const handleScore = roll + fielderData.glove;
		
		// Determine required score based on Batter Response Outcome
		const handleScoreNeeded = {
			'Dribbler*': 4,
			'Can of Corn': 3,
			'Bloop': 5,
			'Screamer*': 6,
			'Laser': 7
		};
		
		const scoreNeeded = handleScoreNeeded[brOutcome] || 0;
		const handled = handleScore >= scoreNeeded;
		
		let result;
		if (handled) {
			result = 'Handled';
			// Increment outs for successful fielding
			outs++;
			updateOutsDisplay();
			// Check if 3 outs reached
			if (outs >= 3) {
				advanceToNextHalfInning();
			}
		} else {
			result = 'Not Handled - Single, Runners advance 1 base';
			// Advance existing runners one base, then add batter to 1B
			advanceRunners();
			addRunnerToBase('1b');
			updateBasesDisplay();
			updateScoreDisplay();
		}
		
		// Update fielder highlight color based on handle result
		updateFielderHighlightColor(handled);
		
		// Create tab content
		const tabContent = `${createTableHeader()}${createTableRow(roll, 'Handle Check Die (D6)')}${createTableRow(fielderData.glove, "Fielder's Glove Stat")}${createTableRow(handleScore, 'Total Handle Score', true)}${createTableRow(scoreNeeded, 'Score Needed')}${createTableRow(result, 'Result', true)}${closeTable()}`;
		createTab('handle', 'HC', tabContent, true);		// Disable the handle check button after it's been clicked
		document.getElementById('handleCheckButton').disabled = true;	}

	function startBatterResponse() {
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		const pitcher = teamsData[pitchingTeamIndex].players[currentPitcherIndex];
		const roll = Math.floor(Math.random() * 12) + 1;
		
		// Special rule: Nat 1 is always strikeout swinging
		if (roll === 1) {
			// Update outcome display above zone
			document.getElementById('outcome-line1').textContent = 'SO Swinging';
			document.getElementById('outcome-line2').textContent = 'Strikeout';
			document.getElementById('outcome-line3').textContent = 'OUT';
			
			// Create tab for result
			let brChart = `${createTableHeader()}${createTableRow(roll, 'D12 (Nat 1)')}${createTableRow('SO Swinging', 'Result')}${closeTable()}`;
			createTab('br', 'BR', brChart, true);
			
			// Increment outs
			outs++;
			updateOutsDisplay();
			// Check if 3 outs reached
			if (outs >= 3) {
				advanceToNextHalfInning();
			}
			
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
			outcome = "Dribbler*";
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
		
		// Update outcome display above zone
		document.getElementById('outcome-line1').textContent = outcome;
		document.getElementById('outcome-line2').textContent = parentOutcome;
		
		// Determine play type for line3
		let brPlayType = '';
		if (total >= 12) {
			brPlayType = '+4 BASES';
		} else if (total <= 3) {
			brPlayType = 'OUT';
			// Increment outs for strikeout
			outs++;
			updateOutsDisplay();
			// Check if 3 outs reached
			if (outs >= 3) {
				advanceToNextHalfInning();
			}
		} else if (total >= 4 && total <= 11) {
			brPlayType = 'IN-PLAY';
		}
		document.getElementById('outcome-line3').textContent = brPlayType;
		
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
		}
		
		// Disable the batter response button after it's been clicked
		document.getElementById('batterResponseButton').disabled = true;
		
		// Update tab for Batter Response
		let brChart = `${createTableHeader()}${createTableRow(roll, 'D12')}${createTableRow(-pitcher.velocity, "Pitcher's Velocity Stat")}${createTableRow('+' + batter.contact, "Batter's Contact Stat")}`;
		
		if (pdModifier === 1) {
			brChart += `${createTableRow('+1', 'Down the Middle Mod')}`;
		} else if (pdModifier === -1) {
			brChart += `${createTableRow('-1', 'Painted Mod')}`;
		}
		
		if (subtotal >= 9) {
			brChart += `${createTableRow('+' + batter.power, "Batter's Power Stat")}`;
		}
		
		brChart += `${createTableRow(total, 'Total Result', true)}${createTableRow('', outcome)}${createTableRow('', parentOutcome)}${closeTable()}`;
		createTab('br', 'BR', brChart, true);
	}

	function startPitcherDelivery() {
		if (pitchingTeamIndex === '' || battingTeamIndex === '' || currentPitcherIndex === -1 || currentBatterIndex === -1) {
			alert('Please select teams and a pitcher and batter.');
			return;
		}
		const pitcher = teamsData[pitchingTeamIndex].players[currentPitcherIndex];
		const batter = teamsData[battingTeamIndex].players[currentBatterIndex];
		const roll = Math.floor(Math.random() * 20) + 1;
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
			line1 = 'Strikeout Swinging';
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
				updateScoreDisplay();
				// Re-enable pitcher delivery button to pitch again (only case where this happens)
				document.getElementById('startButton').disabled = false;
			} else {
				// No runners: it's a walk
				addRunnerToBase('1b');
				updateBasesDisplay();
			}
		} else if (outcome === 'Ball' || outcome === 'BB') {
			// Walk: advance runners only if forced (existing baserunners advance only if there are runners behind them)
			if (hasRunners()) {
				advanceRunnersOnWalk();
			}
			addRunnerToBase('1b');
			updateBasesDisplay();
			updateScoreDisplay();
		}
		
		// Display outcome lines above zone
		document.getElementById('outcome-line1').textContent = line1;
		document.getElementById('outcome-line2').textContent = line2;
		
		// Determine play type for line3
		let playType = '';
		if (outcome === 'Wild Pitch') {
			playType = 'NEXT PITCH';
		} else if (outcome === 'Ball' || outcome === 'BB') {
			playType = 'WALK';
		} else if (outcome === 'Strikeout Looking') {
			playType = 'OUT';
		} else {
			playType = 'IN-PLAY';
		}
		document.getElementById('outcome-line3').textContent = playType;

		if (total >= 5 && total <= 19) {
			document.getElementById('batterResponseButton').disabled = false;
		} else {
			document.getElementById('batterResponseButton').disabled = true;
		}
		
		// Disable the start button after it's been clicked, unless it's a wild pitch with runners
		// (in which case it was re-enabled above to allow another pitch)
		if (!(outcome === 'Wild Pitch' && wildPitchWithRunners)) {
			document.getElementById('startButton').disabled = true;
		}
		
		// Update tab for Pitcher Delivery
		const pdChart = `${createTableHeader()}${createTableRow(roll, 'Pitcher Delivery D20 Roll')}${createTableRow(-batter.eye, "Batter's Eye Stat")}${createTableRow('+' + pitcher.control, "Pitcher's Control Stat")}${createTableRow(total, 'Total Result', true)}${createTableRow('', outcome)}${closeTable()}`;
		createTab('pd', 'PD', pdChart, true);
	}

    // attach event listeners after DOM is loaded
	document.addEventListener('DOMContentLoaded', function () {
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
		document.getElementById('nextBatterButton').addEventListener('click', nextBatter);

		// Expose functions globally for onclick handlers in HTML
		window.setCurrentPitcherGlobal = setCurrentPitcher;
		window.setCurrentBatterGlobal = setCurrentBatter;

		// Initialize bases and score display
		updateBasesDisplay();
		updateScoreDisplay();
	});
})();

