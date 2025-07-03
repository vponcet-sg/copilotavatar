// Parameters
@description('Name of the environment - used to generate unique resource names')
param environmentName string

@description('Azure region for all resources')
param location string = resourceGroup().location

// Environment variables for the React app
@description('Azure Speech Services Key')
@secure()
param speechKey string

@description('Azure Speech Services Endpoint')
param speechEndpoint string

@description('Azure Speech Services Region')
param speechRegion string

@description('Bot Framework Direct Line Secret')
@secure()
param directLineSecret string

@description('Azure Avatar Subscription Key')
@secure()
param avatarSubscriptionKey string

@description('Azure Avatar Region')
param avatarRegion string

@description('Azure Avatar Endpoint')
param avatarEndpoint string

@description('Avatar Character')
param avatarCharacter string = 'lisa'

@description('Avatar Style')
param avatarStyle string = 'casual-sitting'

@description('Avatar Voice')
param avatarVoice string = 'en-US-AvaMultilingualNeural'

// Generate unique resource names using the environment name and subscription ID
var resourceToken = toLower(uniqueString(subscription().subscriptionId, environmentName))
var abbrs = loadJsonContent('./abbreviations.json')

// Resource names following naming conventions
var appServicePlanName = '${abbrs.webServerFarms}${environmentName}-${resourceToken}'
var webAppName = '${abbrs.webSitesAppService}${environmentName}-${resourceToken}'
var keyVaultName = '${abbrs.keyVaultVaults}${environmentName}-${resourceToken}'
var logAnalyticsName = '${abbrs.operationalInsightsWorkspaces}${environmentName}-${resourceToken}'
var appInsightsName = '${abbrs.insightsComponents}${environmentName}-${resourceToken}'
var managedIdentityName = '${abbrs.managedIdentityUserAssignedIdentities}${environmentName}-${resourceToken}'

// Tags
var tags = {
  'azd-env-name': environmentName
}

// User-assigned managed identity
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdentityName
  location: location
  tags: tags
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 90
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    IngestionMode: 'LogAnalytics'
  }
}

// Key Vault for storing secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
    accessPolicies: [
      {
        tenantId: tenant().tenantId
        objectId: managedIdentity.properties.principalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
    enabledForTemplateDeployment: true
    enableRbacAuthorization: false
  }
}

// Store secrets in Key Vault
resource speechKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'speech-key'
  properties: {
    value: speechKey
  }
}

resource directLineSecretKv 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'directline-secret'
  properties: {
    value: directLineSecret
  }
}

resource avatarSubscriptionKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'avatar-subscription-key'
  properties: {
    value: avatarSubscriptionKey
  }
}

// App Service Plan for hosting the React app
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 1
  }
  properties: {
    reserved: false // Windows App Service Plan
  }
}

// App Service for the React application
resource webApp 'Microsoft.Web/sites@2024-04-01' = {
  name: webAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  kind: 'app'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    keyVaultReferenceIdentity: managedIdentity.id
    siteConfig: {
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '18-lts'
        }
        {
          name: 'VITE_SPEECH_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=speech-key)'
        }
        {
          name: 'VITE_SPEECH_ENDPOINT'
          value: speechEndpoint
        }
        {
          name: 'VITE_SPEECH_REGION'
          value: speechRegion
        }
        {
          name: 'VITE_DIRECTLINE_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=directline-secret)'
        }
        {
          name: 'VITE_AVATAR_SUBSCRIPTION_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=avatar-subscription-key)'
        }
        {
          name: 'VITE_AVATAR_REGION'
          value: avatarRegion
        }
        {
          name: 'VITE_AVATAR_ENDPOINT'
          value: avatarEndpoint
        }
        {
          name: 'VITE_AVATAR_CHARACTER'
          value: avatarCharacter
        }
        {
          name: 'VITE_AVATAR_STYLE'
          value: avatarStyle
        }
        {
          name: 'VITE_AVATAR_VOICE'
          value: avatarVoice
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
      cors: {
        allowedOrigins: ['*']
        supportCredentials: false
      }
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      webSocketsEnabled: true
    }
  }
}

// Diagnostic settings for the web app
resource webAppDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${webAppName}-diagnostics'
  scope: webApp
  properties: {
    workspaceId: logAnalytics.id
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

// Outputs for the Azure Developer CLI
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output WEBSITE_URL string = 'https://${webApp.properties.defaultHostName}'
output APPLICATIONINSIGHTS_CONNECTION_STRING string = appInsights.properties.ConnectionString
output AZURE_KEY_VAULT_NAME string = keyVault.name
output WEB_APP_NAME string = webApp.name
output WEB_APP_IDENTITY_PRINCIPAL_ID string = managedIdentity.properties.principalId
