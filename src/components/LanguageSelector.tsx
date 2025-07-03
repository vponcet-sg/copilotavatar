import React, { useState, useEffect } from 'react';
import ConfigService from '../services/ConfigService';
import type { LanguageOption } from '../types';

interface LanguageSelectorProps {
  onLanguageChange?: (languageCode: string) => void;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onLanguageChange,
  className = ''
}) => {
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [autoDetectEnabled, setAutoDetectEnabled] = useState<boolean>(true);

  useEffect(() => {
    const configService = ConfigService.getInstance();
    const languages = configService.getAvailableLanguages();
    const multiLingualConfig = configService.getMultiLingualConfig();
    
    setAvailableLanguages(languages);
    setSelectedLanguage(multiLingualConfig.primaryLanguage);
    setAutoDetectEnabled(multiLingualConfig.autoDetect);
  }, []);

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    
    // Update configuration
    const configService = ConfigService.getInstance();
    configService.updateSettings({
      recognitionLanguage: languageCode,
      primaryLanguage: languageCode,
      synthesisLanguage: languageCode
    });
    
    // Notify parent component
    onLanguageChange?.(languageCode);
    
    console.log('🌐 Language changed to:', languageCode);
  };

  const handleAutoDetectToggle = () => {
    const newAutoDetect = !autoDetectEnabled;
    setAutoDetectEnabled(newAutoDetect);
    
    // Update configuration
    const configService = ConfigService.getInstance();
    configService.updateSettings({
      multiLingualEnabled: newAutoDetect
    });
    
    console.log('🌐 Auto-detect toggled:', newAutoDetect);
  };

  const getFlagEmoji = (regionCode: string): string => {
    const flagMap: { [key: string]: string } = {
      'us': '🇺🇸', 'gb': '🇬🇧', 'es': '🇪🇸', 'mx': '🇲🇽', 'fr': '🇫🇷', 'ca': '🇨🇦',
      'de': '🇩🇪', 'it': '🇮🇹', 'br': '🇧🇷', 'pt': '🇵🇹', 'jp': '🇯🇵', 'kr': '🇰🇷',
      'cn': '🇨🇳', 'hk': '🇭🇰', 'tw': '🇹🇼', 'sa': '🇸🇦', 'in': '🇮🇳', 'th': '🇹🇭',
      'vn': '🇻🇳', 'nl': '🇳🇱', 'se': '🇸🇪', 'dk': '🇩🇰', 'no': '🇳🇴', 'fi': '🇫🇮',
      'ru': '🇷🇺', 'pl': '🇵🇱', 'tr': '🇹🇷', 'il': '🇮🇱'
    };
    return flagMap[regionCode] || '🌐';
  };

  return (
    <div className={`language-selector ${className}`}>
      <div className="language-header">
        <h4>🌐 Language Settings</h4>
        
        <div className="auto-detect-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoDetectEnabled}
              onChange={handleAutoDetectToggle}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Auto-detect</span>
          </label>
        </div>
      </div>

      {!autoDetectEnabled && (
        <div className="language-dropdown">
          <label htmlFor="language-select">Primary Language:</label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="language-select"
          >
            {availableLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {getFlagEmoji(lang.region)} {lang.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {autoDetectEnabled && (
        <div className="auto-detect-info">
          <p>
            <span className="auto-detect-icon">🎯</span>
            Auto-detection enabled for {availableLanguages.length} languages
          </p>
          <div className="supported-languages">
            {availableLanguages.slice(0, 8).map((lang, index) => (
              <span key={lang.code} className="language-flag" title={lang.name}>
                {getFlagEmoji(lang.region)}
                {index < 7 && index < availableLanguages.length - 1 ? ' ' : ''}
              </span>
            ))}
            {availableLanguages.length > 8 && (
              <span className="more-languages" title={`+${availableLanguages.length - 8} more languages`}>
                +{availableLanguages.length - 8}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
