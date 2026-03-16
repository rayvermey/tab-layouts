# tab-layouts
Obsidian plugin to load saved workspace layout when clicking a tab

With this plugin you can create a layout, save it and give it a name, dashboard for instance.
Then you can use a tab called dashboard and the saved layout with the name of the tab will be loaded automatically.

# Documentation

                                                                   ✔  10218  21:46:45
# Tab Layouts

Save and restore sidebar layouts per tab in Obsidian. When you switch to a pinned tab, the associated workspace (with its sidebar configuration) is automatically loaded.

## Features

- **Automatic Workspace Switching**: When you switch to a tab, automatically load the associated workspace
- **Sidebar Control**: Control which sidebars are visible for each tab
- **Simple Setup**: Use the command palette to link a tab to a workspace
- **Settings UI**: Manage tab-to-workspace links through an intuitive settings interface
- **Case-Insensitive**: Workspace names are matched case-insensitively

## How It Works

1. Create workspaces in Obsidian (File > Workspaces > Save current workspace)
2. Open the tab you want to link to a workspace
3. Open the command palette (`Ctrl+P` / `Cmd+P`)
4. Run **"Tab Layouts: Save workspace for this tab"**
5. The tab will now automatically load that workspace when selected

## Usage

### Linking a Tab to a Workspace

1. Make sure you've created the workspaces you want to use (File > Workspaces)
2. Switch to the tab you want to link
3. Run **"Tab Layouts: Save workspace for this tab"** from the command palette
4. The plugin will link the tab name to a workspace with the same name

### Managing Links

Open Settings > Tab Layouts to:
- See all your tab-to-workspace links
- Change which workspace a tab is linked to
- Delete links you no longer need

### How It Determines Tab Names

The plugin tries to get the tab name from:
1. `leaf.getDisplayText()` - most common for regular tabs
2. `leaf.getTitle().heading` - for tabs with headings
3. `leaf.view.getLabel()` - for some view types
4. Special handling for RSS dashboard tabs

## Requirements

- Obsidian 1.0.0 or later
- Workspaces plugin (built-in) for full functionality
- Without the workspaces plugin, only sidebar toggling works

## Installation

### From GitHub

1. Download the latest release
2. Extract the folder to `.obsidian/plugins/tab-layouts`
3. Reload Obsidian
4. Enable the plugin in Settings > Community plugins

### From Obsidian Plugin Registry

Search for "Tab Layouts" in the community plugins browser (coming soon).

## Commands

| Command | Description |
|---------|-------------|
| Save workspace for this tab | Links the current tab to a workspace with the same name |
| Link tab to workspace | Alias for the above command |

## Configuration

The plugin stores its configuration in `.obsidian/plugins/tab-layouts/data.json`.

Each tab-to-workspace link is stored as:
```json
{
  "tab-name": "workspace-name"
}
```

## Troubleshooting

**Workspace not found**
- Make sure the workspace exists in File > Workspaces
- Workspace names are case-insensitive

**Sidebars not toggling**
- Check that the workspace has content in the sidebars
- The plugin toggles sidebars based on whether they have content

**Tab name not detected**
- The tab needs a displayable name
- Try renaming the tab or pinned tab

## License

MIT
