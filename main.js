'use strict';

var obsidian = require('obsidian');

class TabLayoutsPlugin extends obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.layouts = {};
    this.lastLoadedWorkspace = null;
    this.isLoadingWorkspace = false;
    this.loadTimeout = null;
    this.eventListenerDisabled = false;
  }

  async onload() {
    await this.loadSettings();

    // Listen for tab switches
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf) return;
        this.handleTabSwitch(leaf);
      })
    );

    // Add command to save workspace for active tab (using tab name as workspace name)
    this.addCommand({
      id: 'save-workspace-for-tab',
      name: 'Save workspace for this tab',
      callback: () => this.saveLayoutForActiveTab()
    });

    // Add command to link current tab to a specific workspace (uses tab name)
    this.addCommand({
      id: 'link-tab-to-workspace',
      name: 'Link tab to workspace',
      callback: () => this.saveLayoutForActiveTab()
    });

    // Add settings tab
    this.addSettingTab(new TabLayoutsSettingTab(this.app, this));

    console.log('Tab Layouts plugin loaded with layouts:', JSON.stringify(this.layouts));
  }

  async loadSettings() {
    try {
      const data = await this.loadData();
      this.layouts = data?.layouts || {};

      // Clean up old data that was stored incorrectly
      let needsSave = false;
      for (const [key, value] of Object.entries(this.layouts)) {
        if (value && typeof value === 'object') {
          console.log('Tab Layouts: Cleaning up old data for:', key);
          delete this.layouts[key];
          needsSave = true;
        }
      }

      if (needsSave) {
        await this.saveSettings();
        console.log('Tab Layouts: Cleaned up old layout data');
      }
    } catch (e) {
      this.layouts = {};
    }
  }

  async saveSettings() {
    await this.saveData({ layouts: this.layouts });
  }

  handleTabSwitch(leaf) {
    if (!leaf) return;

    let tabTitle = null;

    if (leaf.getDisplayText) {
      tabTitle = leaf.getDisplayText();
    }

    if (!tabTitle && leaf.getTitle) {
      const title = leaf.getTitle();
      if (title && title.heading) {
        tabTitle = title.heading;
      }
    }

    if (!tabTitle && leaf.view && leaf.view.getLabel) {
      tabTitle = leaf.view.getLabel();
    }

    if (!tabTitle && leaf.view && leaf.view.getViewType) {
      const viewType = leaf.view.getViewType();
      if (viewType === 'rss-dashboard' || viewType === 'rss') {
        tabTitle = 'RSS dashboard';
      }
    }

    if (!tabTitle) return;

    // Skip if we just triggered a workspace load (to prevent loops)
    if (this.eventListenerDisabled) {
      console.log('Tab Layouts: Event listener disabled, skipping');
      return;
    }

    console.log('Tab Layouts: Tab switch to:', tabTitle);

    // First, check if we have a manually configured workspace for this tab
    let workspaceName = this.layouts[tabTitle];

    // Handle old data that might be stored as objects - use tab name as fallback
    if (workspaceName && typeof workspaceName === 'object') {
      console.log('Tab Layouts: Fixing old layout data, using tab name instead');
      // Old data stored extra info - just use the tab name as workspace name
      workspaceName = tabTitle;
    }

    // If no manual mapping, use the tab name as workspace name
    if (!workspaceName || typeof workspaceName !== 'string') {
      workspaceName = tabTitle;
    }

    console.log('Tab Layouts: Trying to load workspace:', workspaceName);

    // Small delay to prevent rapid-fire events from causing loops
    // and to let the tab switch settle
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }

    this.loadTimeout = setTimeout(() => {
      this.loadWorkspace(workspaceName);
    }, 300);
  }

  async loadWorkspace(workspaceName) {
    // Prevent re-entrant calls and loops
    if (this.isLoadingWorkspace) {
      console.log('Tab Layouts: Already loading workspace, skipping');
      return;
    }

    // Skip if already loaded this workspace
    if (this.lastLoadedWorkspace === workspaceName) {
      console.log('Tab Layouts: Already loaded:', workspaceName);
      return;
    }

    try {
      this.isLoadingWorkspace = true;
      console.log('Tab Layouts: Loading workspace:', workspaceName);

      // Get the workspaces plugin
      const workspacesPlugin = this.app.internalPlugins?.plugins?.workspaces;
      console.log('Tab Layouts: workspacesPlugin exists:', !!workspacesPlugin);
      console.log('Tab Layouts: workspacesPlugin.instance exists:', !!workspacesPlugin?.instance);

      const instance = workspacesPlugin?.instance;

      // Try to use the workspaces plugin's official method
      if (instance) {
        // Find the correct workspace name (case-insensitive)
        const availableWorkspaces = Object.keys(instance.workspaces || {});
        console.log('Tab Layouts: Available workspaces in plugin:', availableWorkspaces);
        console.log('Tab Layouts: Instance methods:', Object.keys(instance));

        let targetWorkspace = workspaceName;

        if (!availableWorkspaces.includes(workspaceName)) {
          const found = availableWorkspaces.find(w => w.toLowerCase() === workspaceName.toLowerCase());
          if (found) {
            targetWorkspace = found;
            console.log('Tab Layouts: Using case-insensitive match:', targetWorkspace);
          }
        }

        // Try different method names
        if (typeof instance.switchToWorkspace === 'function') {
          console.log('Tab Layouts: Using switchToWorkspace:', targetWorkspace);
          this.eventListenerDisabled = true;
          instance.switchToWorkspace(targetWorkspace);
          setTimeout(() => { this.eventListenerDisabled = false; }, 2000);
          this.lastLoadedWorkspace = targetWorkspace;
          return;
        }

        // Try alternative method names
        if (typeof instance.openWorkspace === 'function') {
          console.log('Tab Layouts: Using openWorkspace:', targetWorkspace);
          this.eventListenerDisabled = true;
          instance.openWorkspace(targetWorkspace);
          setTimeout(() => { this.eventListenerDisabled = false; }, 2000);
          this.lastLoadedWorkspace = targetWorkspace;
          return;
        }

        if (typeof instance.loadWorkspace === 'function') {
          console.log('Tab Layouts: Using loadWorkspace:', targetWorkspace);
          this.eventListenerDisabled = true;
          instance.loadWorkspace(targetWorkspace);
          setTimeout(() => { this.eventListenerDisabled = false; }, 2000);
          this.lastLoadedWorkspace = targetWorkspace;
          return;
        }
      }

      // Fallback: If workspaces plugin not available, just toggle sidebars
      console.log('Tab Layouts: No workspaces plugin, falling back to sidebar toggle');

      const workspacesData = await this.app.vault.adapter.read('.obsidian/workspaces.json');
      const workspaces = JSON.parse(workspacesData).workspaces;

      let workspace = workspaces[workspaceName];
      let matchedName = workspaceName;

      if (!workspace) {
        const workspaceKeys = Object.keys(workspaces);
        const foundKey = workspaceKeys.find(k => k.toLowerCase() === workspaceName.toLowerCase());
        if (foundKey) {
          workspace = workspaces[foundKey];
          matchedName = foundKey;
        }
      }

      if (!workspace) {
        console.log('Tab Layouts: Workspace not found:', workspaceName);
        return;
      }

      this.lastLoadedWorkspace = matchedName;
      this.toggleSidebarsFromWorkspace(workspace);

    } catch (e) {
      console.log('Tab Layouts: Error loading workspace:', e);
    } finally {
      setTimeout(() => {
        this.isLoadingWorkspace = false;
      }, 1000);
    }
  }

  toggleSidebarsFromWorkspace(workspace) {
    // Determine if sidebars have content (based on children)
    const leftHasContent = workspace.left && workspace.left.children && workspace.left.children.length > 0;
    const rightHasContent = workspace.right && workspace.right.children && workspace.right.children.length > 0;

    // If sidebar has content, we want it open. Simple!
    const leftShouldOpen = leftHasContent;
    const rightShouldOpen = rightHasContent;

    console.log('Tab Layouts: Left has content:', leftHasContent, 'Right has content:', rightHasContent);
    console.log('Tab Layouts: Left should be open:', leftShouldOpen, 'Right should be open:', rightShouldOpen);

    // Check current state using Obsidian's API
    let leftCurrentlyOpen = true;
    let rightCurrentlyOpen = true;

    try {
      const ws = this.app.workspace;
      if (ws.leftSidebar) {
        leftCurrentlyOpen = !ws.leftSidebar.collapsed;
      }
      if (ws.rightSidebar) {
        rightCurrentlyOpen = !ws.rightSidebar.collapsed;
      }
    } catch (e) {
      // Fallback: assume open if we can't check
    }

    console.log('Tab Layouts: Current state - Left open:', leftCurrentlyOpen, 'Right open:', rightCurrentlyOpen);

    // Toggle sidebars to match desired state
    if (leftShouldOpen && !leftCurrentlyOpen) {
      this.app.commands.executeCommandById('sidebar:toggle-left');
      console.log('Tab Layouts: Opened left sidebar');
    } else if (!leftShouldOpen && leftCurrentlyOpen) {
      this.app.commands.executeCommandById('sidebar:toggle-left');
      console.log('Tab Layouts: Closed left sidebar');
    }

    if (rightShouldOpen && !rightCurrentlyOpen) {
      this.app.commands.executeCommandById('sidebar:toggle-right');
      console.log('Tab Layouts: Opened right sidebar');
    } else if (!rightShouldOpen && rightCurrentlyOpen) {
      this.app.commands.executeCommandById('sidebar:toggle-right');
      console.log('Tab Layouts: Closed right sidebar');
    }
  }


  async saveLayoutForActiveTab() {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf) {
      new obsidian.Notice('No active tab found');
      return;
    }

    let tabTitle = null;

    if (leaf.getDisplayText) {
      tabTitle = leaf.getDisplayText();
    }

    if (!tabTitle && leaf.getTitle) {
      const title = leaf.getTitle();
      if (title && title.heading) {
        tabTitle = title.heading;
      }
    }

    if (!tabTitle && leaf.view && leaf.view.getLabel) {
      tabTitle = leaf.view.getLabel();
    }

    if (!tabTitle && leaf.view && leaf.view.getViewType) {
      const viewType = leaf.view.getViewType();
      if (viewType === 'rss-dashboard' || viewType === 'rss') {
        tabTitle = 'RSS dashboard';
      }
    }

    if (!tabTitle) {
      new obsidian.Notice('Could not determine tab name');
      return;
    }

    // Use tab name as workspace name
    const workspaceName = tabTitle;

    this.layouts[tabTitle] = workspaceName;
    await this.saveSettings();

    new obsidian.Notice(`Linked tab "${tabTitle}" to workspace "${workspaceName}"`);
    console.log('Tab Layouts: Saved layout for', tabTitle, '-> workspace:', workspaceName);
  }

  async showWorkspacePicker() {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf) {
      new obsidian.Notice('No active tab found');
      return;
    }

    let tabTitle = null;

    if (leaf.getDisplayText) {
      tabTitle = leaf.getDisplayText();
    }

    if (!tabTitle && leaf.getTitle) {
      const title = leaf.getTitle();
      if (title && title.heading) {
        tabTitle = title.heading;
      }
    }

    if (!tabTitle && leaf.view && leaf.view.getLabel) {
      tabTitle = leaf.view.getLabel();
    }

    if (!tabTitle && leaf.view && leaf.view.getViewType) {
      const viewType = leaf.view.getViewType();
      if (viewType === 'rss-dashboard' || viewType === 'rss') {
        tabTitle = 'RSS dashboard';
      }
    }

    if (!tabTitle) {
      new obsidian.Notice('Could not determine tab name');
      return;
    }

    // Link the tab to a workspace with the same name (or manually edit in settings)
    this.layouts[tabTitle] = tabTitle;
    await this.saveSettings();

    new obsidian.Notice(`Linked tab "${tabTitle}" to workspace "${tabTitle}". Edit in settings to change.`);
    console.log('Tab Layouts: Saved layout for', tabTitle, '-> workspace:', tabTitle);
  }

  // Helper to get available workspaces
  async getAvailableWorkspaces() {
    try {
      const workspacesData = await this.app.vault.adapter.read('.obsidian/workspaces.json');
      const workspaces = JSON.parse(workspacesData).workspaces;
      return Object.keys(workspaces);
    } catch (e) {
      console.log('Tab Layouts: Error loading workspaces:', e);
      return [];
    }
  }
}

class TabLayoutsSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Tab Workspaces' });

    containerEl.createEl('p', {
      text: 'Link tabs to workspaces. When you switch to a tab, the selected workspace will be loaded.'
    });

    const helpP = containerEl.createEl('p', {
      text: 'Use command palette (Ctrl+P) and run "Tab Workspaces: Save workspace for this tab" to add a new tab link.'
    });
    helpP.style.fontSize = '0.9em';
    helpP.style.color = 'var(--text-muted)';

    const layoutsDiv = containerEl.createDiv();
    layoutsDiv.style.marginTop = '20px';

    // Load available workspaces
    let workspaceNames = [];
    try {
      const workspacesData = await this.app.vault.adapter.read('.obsidian/workspaces.json');
      workspaceNames = Object.keys(JSON.parse(workspacesData).workspaces);
    } catch (e) {
      console.log('Tab Layouts: Error loading workspaces for settings:', e);
    }

    const layouts = this.plugin.layouts;
    if (Object.keys(layouts).length === 0) {
      layoutsDiv.createEl('p', { text: 'No tab-to-workspace links configured. Use the command to add one.' });
    } else {
      for (const [tabName, workspaceName] of Object.entries(layouts)) {
        const itemDiv = layoutsDiv.createDiv();
        itemDiv.style.padding = '10px';
        itemDiv.style.marginBottom = '8px';
        itemDiv.style.border = '1px solid var(--border-color)';
        itemDiv.style.borderRadius = '4px';

        const headerDiv = itemDiv.createDiv();
        headerDiv.style.marginBottom = '8px';
        headerDiv.createEl('strong', { text: 'Tab: ' + tabName });

        // Create dropdown for workspace selection
        const selectWrapper = itemDiv.createDiv();
        selectWrapper.style.display = 'flex';
        selectWrapper.style.gap = '10px';
        selectWrapper.style.alignItems = 'center';

        const selectLabel = selectWrapper.createEl('span', { text: 'Workspace: ' });

        const select = selectWrapper.createEl('select');
        select.style.flex = '1';

        // Add default option
        const defaultOption = select.createEl('option');
        defaultOption.value = tabName;
        defaultOption.text = tabName + ' (tab name)';
        defaultOption.selected = (workspaceName === tabName);

        // Add workspace options
        for (const ws of workspaceNames) {
          const option = select.createEl('option');
          option.value = ws;
          option.text = ws;
          if (ws === workspaceName) {
            option.selected = true;
          }
        }

        // Handle selection change
        select.addEventListener('change', async () => {
          this.plugin.layouts[tabName] = select.value;
          await this.plugin.saveSettings();
          new obsidian.Notice(`Updated: ${tabName} → ${select.value}`);
        });

        const deleteBtn = selectWrapper.createEl('button', {
          text: 'Delete',
          cls: 'mod-destructive'
        });
        deleteBtn.style.marginTop = '8px';
        deleteBtn.addEventListener('click', async () => {
          delete this.plugin.layouts[tabName];
          await this.plugin.saveSettings();
          this.display();
        });
      }
    }
  }
}

module.exports = TabLayoutsPlugin;