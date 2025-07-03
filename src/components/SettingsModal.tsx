import React, { useState, useEffect } from 'react';

interface SettingsConfig {
  // Speech Service
  speechKey: string;
  speechRegion: string;
  speechEndpoint: string;
  
  // Bot Service
  directLineSecret: string;
  
  // Avatar Configuration
  avatarCharacter: string;
  avatarStyle: string;
  avatarVoice: string;
  
  // Avatar API
  avatarSubscriptionKey: string;
  avatarRegion: string;
  avatarEndpoint: string;
}

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (config: SettingsConfig) => void;
}

const defaultConfig: SettingsConfig = {
  speechKey: import.meta.env.VITE_SPEECH_KEY || '',
  speechRegion: import.meta.env.VITE_SPEECH_REGION || '',
  speechEndpoint: import.meta.env.VITE_SPEECH_ENDPOINT || '',
  directLineSecret: import.meta.env.VITE_DIRECTLINE_SECRET || '',
  avatarCharacter: import.meta.env.VITE_AVATAR_CHARACTER || 'lisa',
  avatarStyle: import.meta.env.VITE_AVATAR_STYLE || 'graceful-sitting',
  avatarVoice: import.meta.env.VITE_AVATAR_VOICE || 'en-US-JennyNeural',
  avatarSubscriptionKey: import.meta.env.VITE_AVATAR_SUBSCRIPTION_KEY || '',
  avatarRegion: import.meta.env.VITE_AVATAR_REGION || '',
  avatarEndpoint: import.meta.env.VITE_AVATAR_ENDPOINT || '',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  show,
  onClose,
  onSave
}) => {
  const [config, setConfig] = useState<SettingsConfig>(defaultConfig);
  const [activeTab, setActiveTab] = useState<'speech' | 'bot' | 'avatar' | 'api'>('speech');
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Load saved settings from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('app-settings');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({ ...defaultConfig, ...parsed });
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const handleInputChange = (field: keyof SettingsConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setUnsavedChanges(true);
  };

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('app-settings', JSON.stringify(config));
    onSave(config);
    setUnsavedChanges(false);
    onClose();
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setUnsavedChanges(true);
  };

  const handleClose = () => {
    if (unsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className="settings-modal-overlay" onClick={handleClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Application Settings</h2>
          <button className="settings-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'speech' ? 'active' : ''}`}
            onClick={() => setActiveTab('speech')}
          >
            🎤 Speech Service
          </button>
          <button
            className={`settings-tab ${activeTab === 'bot' ? 'active' : ''}`}
            onClick={() => setActiveTab('bot')}
          >
            🤖 Bot Service
          </button>
          <button
            className={`settings-tab ${activeTab === 'avatar' ? 'active' : ''}`}
            onClick={() => setActiveTab('avatar')}
          >
            🎭 Avatar Config
          </button>
          <button
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            🔗 Avatar API
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'speech' && (
            <div className="settings-section">
              <h3>Azure Speech Service Configuration</h3>
              <div className="settings-group">
                <label htmlFor="speechKey">Speech Service Key *</label>
                <input
                  id="speechKey"
                  type="password"
                  value={config.speechKey}
                  onChange={(e) => handleInputChange('speechKey', e.target.value)}
                  placeholder="Enter your Azure Speech Service key"
                />
              </div>
              <div className="settings-group">
                <label htmlFor="speechRegion">Speech Service Region *</label>
                <input
                  id="speechRegion"
                  type="text"
                  value={config.speechRegion}
                  onChange={(e) => handleInputChange('speechRegion', e.target.value)}
                  placeholder="e.g., eastus, westus2"
                />
              </div>
              <div className="settings-group">
                <label htmlFor="speechEndpoint">Speech Service Endpoint *</label>
                <input
                  id="speechEndpoint"
                  type="url"
                  value={config.speechEndpoint}
                  onChange={(e) => handleInputChange('speechEndpoint', e.target.value)}
                  placeholder="https://your-region.api.cognitive.microsoft.com/"
                />
              </div>
            </div>
          )}

          {activeTab === 'bot' && (
            <div className="settings-section">
              <h3>Bot Framework Configuration</h3>
              <div className="settings-group">
                <label htmlFor="directLineSecret">Direct Line Secret *</label>
                <input
                  id="directLineSecret"
                  type="password"
                  value={config.directLineSecret}
                  onChange={(e) => handleInputChange('directLineSecret', e.target.value)}
                  placeholder="Enter your Direct Line secret"
                />
              </div>
              <p className="settings-help">
                Get this from your Bot Framework channel configuration in Azure Portal.
              </p>
            </div>
          )}

          {activeTab === 'avatar' && (
            <div className="settings-section">
              <h3>Avatar Appearance & Voice</h3>
              <div className="settings-group">
                <label htmlFor="avatarCharacter">Avatar Character</label>
                <select
                  id="avatarCharacter"
                  value={config.avatarCharacter}
                  onChange={(e) => handleInputChange('avatarCharacter', e.target.value)}
                >
                  <option value="lisa">Lisa</option>
                  <option value="anna">Anna</option>
                  <option value="tom">Tom</option>
                  <option value="sam">Sam</option>
                </select>
              </div>
              <div className="settings-group">
                <label htmlFor="avatarStyle">Avatar Style</label>
                <select
                  id="avatarStyle"
                  value={config.avatarStyle}
                  onChange={(e) => handleInputChange('avatarStyle', e.target.value)}
                >
                  <option value="graceful-sitting">Graceful Sitting</option>
                  <option value="casual-sitting">Casual Sitting</option>
                  <option value="standing">Standing</option>
                  <option value="technical-sitting">Technical Sitting</option>
                </select>
              </div>
              <div className="settings-group">
                <label htmlFor="avatarVoice">Avatar Voice</label>
                <select
                  id="avatarVoice"
                  value={config.avatarVoice}
                  onChange={(e) => handleInputChange('avatarVoice', e.target.value)}
                >
                  <option value="en-US-JennyNeural">Jenny (English US - Female)</option>
                  <option value="en-US-AriaNeural">Aria (English US - Female)</option>
                  <option value="en-US-GuyNeural">Guy (English US - Male)</option>
                  <option value="en-US-DavisNeural">Davis (English US - Male)</option>
                  <option value="en-GB-SoniaNeural">Sonia (English UK - Female)</option>
                  <option value="en-GB-RyanNeural">Ryan (English UK - Male)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="settings-section">
              <h3>Azure Avatar Real-Time API</h3>
              <div className="settings-group">
                <label htmlFor="avatarSubscriptionKey">Avatar API Subscription Key *</label>
                <input
                  id="avatarSubscriptionKey"
                  type="password"
                  value={config.avatarSubscriptionKey}
                  onChange={(e) => handleInputChange('avatarSubscriptionKey', e.target.value)}
                  placeholder="Enter your Azure Avatar API key"
                />
              </div>
              <div className="settings-group">
                <label htmlFor="avatarRegion">Avatar API Region *</label>
                <input
                  id="avatarRegion"
                  type="text"
                  value={config.avatarRegion}
                  onChange={(e) => handleInputChange('avatarRegion', e.target.value)}
                  placeholder="e.g., eastus, westus2"
                />
              </div>
              <div className="settings-group">
                <label htmlFor="avatarEndpoint">Avatar API Endpoint *</label>
                <input
                  id="avatarEndpoint"
                  type="url"
                  value={config.avatarEndpoint}
                  onChange={(e) => handleInputChange('avatarEndpoint', e.target.value)}
                  placeholder="https://your-region.avatar.speech.microsoft.com/"
                />
              </div>
            </div>
          )}
        </div>

        <div className="settings-footer">
          <div className="settings-actions-left">
            <button
              className="settings-button secondary"
              onClick={handleReset}
            >
              🔄 Reset to Defaults
            </button>
          </div>
          <div className="settings-actions-right">
            <button
              className="settings-button secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="settings-button primary"
              onClick={handleSave}
              disabled={!unsavedChanges}
            >
              💾 Save Settings
            </button>
          </div>
        </div>

        {unsavedChanges && (
          <div className="settings-warning">
            ⚠️ You have unsaved changes. Click "Save Settings" to apply them.
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
