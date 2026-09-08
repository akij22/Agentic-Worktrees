[← Capability System](<Agentic Worktrees - Capability System.md>)

## Capability vs Implementation

Separare chiaramente due concetti.

### Capability

Descrive **cosa viene aggiunto**.

Esempio:

**Browser Automation**

Provides:

- open page
   
- click element
   
- take screenshot
   
- inspect DOM
   

Compatibility:

- Codex
   
- OpenCode
   

---

### Implementation

Descrive **come quella capability viene fornita ad uno specifico agente**.

Una stessa capability può avere implementazioni differenti:

```text
Browser Automation

├── MCP implementation
├── OpenCode plugin
└── Agentic Worktrees native implementation

```

Agentic Worktrees seleziona automaticamente l'implementazione corretta in base al coding agent utilizzato.

L'utente continua a vedere solamente:

> Browser Automation

e non deve conoscere i dettagli dell'adapter utilizzato.

---

## Supported Capability Types

Il sistema può supportare progressivamente diversi tipi di capability.

### Skills

Workflow e istruzioni riutilizzabili.

Esempi:

- TDD
   
- Security Review
   
- Systematic Debugging
   
- React Best Practices
   

Sono le capability più semplici e portabili tra Codex e OpenCode.

---

### MCP Integrations

Capability fornite tramite server MCP.

Esempi:

- browser

- GitHub

- database

- documentation

- external APIs


MCP rappresenta anche il **meccanismo comune di adattamento** con cui Agentic Worktrees può rendere i tool di una extension disponibili sia a **Codex** sia a **OpenCode**.

In pratica, una extension viene adattata al Capability SDK, i suoi tool vengono registrati nel runtime di Agentic Worktrees e poi esposti agli agenti attraverso un **bridge/server MCP**.

Quando possibile, MCP dovrebbe essere preferito rispetto al porting separato di plugin specifici per ogni agente.

---

### Native Agentic Worktrees Extensions

Plugin sviluppati direttamente utilizzando il runtime e l'SDK di Agentic Worktrees.

Possono fornire:

- custom tools
   
- commands
   
- integrations
   
- UI components
   
- event listeners
   
- provider information
   
- automation
   

---

### Agent-specific implementations

Alcune capability possono avere implementazioni specifiche.

Esempio:

```text
Capability: Provider Usage

Codex
→ Agentic Worktrees implementation

OpenCode
→ OpenCode plugin implementation

```

Una capability può quindi essere:

- Codex + OpenCode
   
- Codex only
   
- OpenCode only
   

La compatibilità deve essere dichiarata chiaramente.

---

## Existing Plugin Ecosystems

Ecosistemi come Pi possono essere utilizzati come **source of ideas and existing implementations**, ma le loro extension non devono essere considerate automaticamente compatibili.

Una Pi extension può dipendere da API specifiche come:

- Pi UI

- Pi events

- Pi commands

- Pi provider registry

- Pi tool APIs


Per rendere una extension utilizzabile in Agentic Worktrees con **Codex e OpenCode**, l'adattamento dovrebbe avvenire **comunemente tramite MCP (Model Context Protocol)**.

L'idea è che il plugin non debba conoscere direttamente le API di Codex o OpenCode: la sua logica viene adattata al **Agentic Worktrees Capability SDK** e i tool risultanti vengono esposti agli agenti tramite un **MCP server/bridge gestito da Agentic Worktrees**.

```text
Existing Pi Plugin
        ↓
Analyze reusable logic and tools
        ↓
Agentic Worktrees Capability SDK
        ↓
Expose tools through MCP
        ↓
   ┌───────────┐
   │           │
 Codex      OpenCode
```

Quindi, quando possibile:

- la logica interna del plugin viene riutilizzata;
- le API specifiche di Pi vengono sostituite dal **Capability SDK**;
- i tool registrati dalla capability vengono esposti a Codex/OpenCode tramite **MCP**.

Solo nei casi in cui la extension dipenda fortemente da funzionalità specifiche di Pi non rappresentabili tramite MCP (ad esempio UI custom, lifecycle particolari o API interne), sarà necessario creare un port più specifico.

Pi non è quindi un runtime supportato da Agentic Worktrees.

È una possibile sorgente da cui **scoprire capability interessanti da portare**, mentre MCP rappresenta il principale livello di interoperabilità verso Codex e OpenCode.

---

## Porting Strategy

Non deve essere responsabilità permanente del team Agentic Worktrees convertire ogni plugin esistente.

Il modello ideale è ibrido.

### Early stage

Il team Agentic Worktrees crea manualmente alcuni port importanti per inizializzare l'ecosistema.

Esempi:

- Browser
   
- Web Search
   
- MCP
   
- Usage Monitoring
   
- Memory
   
- GitHub
   
- Subagents
   
- Testing
   
- Review
   
- Context Management
   

---

### Long term

La responsabilità dell'implementazione passa principalmente ai publisher.

Un developer che vuole pubblicare una capability dovrà utilizzare:

> **Agentic Worktrees Capability SDK**

Il team Agentic Worktrees continuerà invece ad essere responsabile di:

- standard
   
- SDK
   
- permissions
   
- marketplace
   
- validation
   
- compatibility contracts
   
- installation lifecycle
   

---

## Agentic Worktrees Capability SDK

Creare un SDK ufficiale che permetta agli sviluppatori di costruire capability compatibili con la piattaforma.

Il Capability SDK deve definire un contratto stabile per dichiarare:

### Metadata

- name
   
- description
   
- version
   
- author
   
- license
   
- source repository
   
- category
   

---

### Compatibility

Dichiarare gli agenti supportati.

Esempio:

```text
Codex      ✓
OpenCode   ✓

```

oppure:

```text
Codex      ✕
OpenCode   ✓

```

---

### Permissions

Ogni capability deve dichiarare esplicitamente quali permessi richiede.

Esempi:

- repository read
   
- repository write
   
- command execution
   
- network access
   
- filesystem access
   
- external services
   
- credential access
   

Agentic Worktrees deve mostrare questi permessi prima dell'installazione.

---

### Tools

Possibilità di aggiungere nuove capacità operative agli agenti.

Esempi:

- browser\_open
   
- database\_query
   
- inspect\_schema
   
- search\_documentation
   

---

### Commands

Possibilità di aggiungere azioni richiamabili dalla UI o dalla chat.

Esempio:

```text
/security-review
/database-inspect

```

---

### Events

Possibilità di reagire agli eventi della piattaforma.

Esempi:

- session started
   
- agent completed
   
- file changed
   
- test failed
   
- worktree created
   
- conflict detected
   

---

### Settings

Ogni capability può esporre configurazioni modificabili dall'utente.

Esempi:

- API endpoint
   
- preferred browser
   
- timeout
   
- provider
   
- feature toggles
   

---

## Publisher Responsibility

In futuro il publisher dovrebbe essere responsabile di:

- implementare la capability;
   
- dichiarare gli agenti supportati;
   
- mantenere le implementazioni;
   
- aggiornare compatibilità e dipendenze;
   
- documentare i permessi richiesti.
   

Agentic Worktrees non dovrebbe diventare il manutentore di ogni plugin.

---

## Platform Responsibility

Agentic Worktrees rimane responsabile di:

- Capability SDK;
   
- runtime;
   
- compatibility standard;
   
- permissions model;
   
- security boundaries;
   
- marketplace;
   
- installation;
   
- updates;
   
- verification;
   
- publisher identity;
   
- capability discovery.
   

---

## Multi-Implementation Capabilities

Una capability può contenere più implementazioni.

Esempio:

```text
Capability: Web Research

Codex
→ MCP implementation

OpenCode
→ OpenCode plugin implementation

```

Agentic Worktrees seleziona automaticamente l'implementazione compatibile con la sessione corrente.

Questo permette il concetto:

> **Publish one Capability, provide multiple adapters underneath.**

---

## Capability Marketplace

Il marketplace non dovrebbe essere organizzato principalmente per tecnologia.

Evitare categorie come:

- Pi Plugins
   
- OpenCode Plugins
   
- MCP Servers
   

Preferire categorie orientate all'obiettivo:

- Web & Browser
   
- Testing
   
- Debugging
   
- Security
   
- Database
   
- Git & GitHub
   
- Review
   
- Memory
   
- DevOps
   
- Documentation
   
- Productivity
   

L'utente cerca:

> Browser Automation

non:

> OpenCode browser plugin.

---

## Chat-Native Installation

Le capability devono essere installabili direttamente dalla chat.

Possibili scope:

- Use once
   
- Current session
   
- Current worktree
   
- Current project
   
- Global
   

Esempio:

```text
Browser Automation

Works with:
✓ Codex
✓ OpenCode

Provides:
• browser navigation
• screenshots
• DOM inspection

[Use once]
[Add to worktree]
[Install]

```

---

## Import Existing Plugin

In futuro permettere agli sviluppatori di importare plugin esistenti.

Esempio:

```text
Import from:
GitHub repository
npm package
Pi extension
OpenCode plugin

```

Agentic Worktrees analizza il plugin e produce un **Portability Report**.

Esempio:

```text
Portability: 75%

Reusable:
✓ tools
✓ configuration
✓ external APIs

Requires adaptation:
⚠ Pi-specific UI
⚠ Pi event lifecycle

```

L'obiettivo non è eseguire automaticamente il plugin originale, ma aiutare il publisher a creare una implementation compatibile.

---

## AI-Assisted Porting

Codex/OpenCode possono essere utilizzati per aiutare gli sviluppatori a convertire plugin esistenti.

Workflow futuro:

```text
Existing plugin
      ↓
Capability analysis
      ↓
Portability report
      ↓
Generate Agentic Worktrees implementation
      ↓
Developer review
      ↓
Test
      ↓
Publish

```

Questo può diventare un **Capability Porting Assistant**.

---

## Trust & Security

Skills e plugin eseguibili devono essere trattati diversamente.

### Skills

Generalmente basso rischio.

Possono principalmente:

- aggiungere instructions;
   
- aggiungere workflow;
   
- guidare il comportamento dell'agente.
   

---

### Executable capabilities

Richiedono controlli più forti.

Mostrare sempre:

- publisher;
   
- source repository;
   
- permissions;
   
- compatibility;
   
- update date;
   
- version;
   
- verification status.
   

Mai installare automaticamente codice eseguibile solamente perché suggerito dall'agente.

---

## Initial Ecosystem Strategy

Per il primo MVP evitare un plugin ecosystem completamente aperto.

Supportare inizialmente:

```text
Capabilities

├── Skills
├── MCP integrations
└── Curated Native Capabilities

```

Agent support:

```text
Codex
OpenCode

```

Successivamente introdurre:

- third-party native plugins;
   
- Capability SDK pubblico;
   
- marketplace submissions;
   
- verified publishers;
   
- automatic update system;
   
- porting assistant.
   

---

## Long-Term Model

Il flusso ideale diventa:

```text
Publisher
   ↓
creates Capability
   ↓
declares supported agents
   ↓
provides implementations
   ↓
publishes to marketplace
   ↓
User selects Capability
   ↓
Agentic Worktrees selects implementation
   ↓
Codex / OpenCode gains the capability

```

---

## Core Principle

L'utente non dovrebbe pensare in termini di:

> plugin Pi
>
> plugin OpenCode
>
> MCP server
>
> Codex integration

Dovrebbe pensare solamente:

> **“What do I want my coding agent to be able to do?”**

Agentic Worktrees si occupa di scegliere e gestire l'implementazione corretta.

---

## Product Identity

Il concetto centrale può essere sintetizzato come:

> **Capabilities are user-facing. Implementations are infrastructure.**

Questo permette ad Agentic Worktrees di diventare un layer indipendente sopra diversi coding agent, invece di essere semplicemente un altro package manager.

---

## Potential MVP

- Capability abstraction
   
- Skills support
   
- MCP capability support
   
- Codex compatibility
   
- OpenCode compatibility
   
- Capability scopes
   
- Chat-native capability selector
   
- Curated native capabilities
   
- Capability permissions
   
- Capability Library
   

### Later

- Agentic Worktrees Capability SDK
   
- Third-party native plugins
   
- Marketplace submissions
   
- Multi-implementation capabilities
   
- Verified publishers
   
- Plugin portability analyzer
   
- AI-assisted plugin porting
   
- Existing Pi/OpenCode plugin import
   
- Public Capability Marketplace
