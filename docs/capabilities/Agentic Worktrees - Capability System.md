[Capability Ecosystem e SDK →](Agentic%20Worktrees%20-%20Capability%20Ecosystem%20e%20SDK.md)

## Capability System
### Vision

Trasformare la chat da semplice interfaccia verso Codex/OpenCode a **workspace estendibile**, in cui ogni sessione può acquisire nuove capacità in base al task da svolgere.

L'app non fornisce direttamente i modelli: utilizza **Codex, OpenCode e futuri coding agent configurati dall'utente tramite subscription, login o API key personali**.

L'obiettivo non è creare un semplice marketplace di extension, ma un sistema in cui l'utente possa:

> **dare a ogni coding session le capacità di cui ha bisogno, esattamente quando servono.**

---

### Concetto principale: Capabilities

Usare **Capability** come **concetto UI generale**, distinguendo internamente:

- **Skills** — workflow, conoscenze e istruzioni specializzate per l'agente.
    
- **Extensions / Plugins** — capacità operative aggiuntive, tool, integrazioni o comportamenti.
    
- **Capability Packs** — gruppi di skill/extension pensati per uno specifico workflow.
---

### Chat-native discovery

Le capability devono essere accessibili direttamente dalla chat.

L'utente può:

- cercarle manualmente;
    
- aggiungerle dal composer;
    
- ricevere suggerimenti contestuali in base al task;
    
- attivarle senza lasciare la conversazione.
    

Esempio:

> “Migra questa applicazione a React 19.”

L'app potrebbe suggerire:

- React 19 Migration
    
- Dependency Migration
    
- UI Regression Review
    
- Verification Pack
    

Il marketplace diventa quindi **task-oriented**, non semplicemente un catalogo di pacchetti.

---

### Capability scopes

Una capability dovrebbe poter essere **attivata con scope diversi**:

- **Use once** — solo per la sessione corrente.
    
- **Worktree** — solo per il task/worktree corrente.
    
- **Project** — disponibile per tutto il repository.
    
- **Global** — disponibile in tutti i progetti.
    

Lo scope `Worktree` è particolarmente importante perché permette di associare capacità specializzate al lavoro svolto da uno specifico agente senza influenzare gli altri worktree.

---

### Cross-agent compatibility

Il sistema deve essere indipendente dal coding agent.

Una capability può essere:

- Universal
    
- Codex compatible
    
- OpenCode compatible
    
- specifica di un singolo provider
    

La UI dovrebbe nascondere il più possibile le differenze tecniche e mostrare semplicemente:

**Compatible with:** Codex · OpenCode

Le Skill portabili dovrebbero essere prioritarie; plugin ed extension eseguibili possono invece avere implementazioni specifiche per provider.

---

### Active Capabilities nella chat

Ogni chat dovrebbe rendere chiaramente visibile cosa sta influenzando l'agente.

Esempio:

**Codex · GPT-5.x · 3 Capabilities**

Active:

- TDD
    
- React Review
    
- Security Review
    

La timeline può inoltre mostrare eventi come:

> Loaded skill: `security-review`

Questo aumenta trasparenza e comprensibilità del comportamento dell'agente.

---

### Contextual Capability Recommendations

Il sistema può **suggerire capability** in base a:

- prompt dell'utente;
    
- stack tecnologico del repository;
    
- file coinvolti;
    
- tipo di task;
    
- coding agent selezionato;
    
- capability usate con successo in precedenza.
    

L'obiettivo è passare da:

**“Quale extension devo installare?”**

a:

**“Sto facendo questo task: quali capacità mi servono?”**

---

### Capability Packs

Creare pacchetti orientati agli obiettivi.

Esempi:

#### PR Ready

- Code Review
    
- Test Verification
    
- Commit conventions
    
- PR Description
    

#### Secure Backend

- Authentication Review
    
- OWASP Review
    
- Dependency Audit
    
- API Security
    

#### Frontend Quality

- React Best Practices
    
- Accessibility
    
- Performance Review
    
- Visual Verification
    

L'utente può attivare un intero workflow senza conoscere ogni singola skill necessaria.

---

### Create Skill from Chat

Una conversazione riuscita dovrebbe poter diventare una capability riutilizzabile.

Azione:

**Save workflow as Skill**

Possibili destinazioni:

- Worktree
    
- Project
    
- Personal library
    
- Publish
    

Questo crea un ciclo:

**Conversation → Successful workflow → Skill → Reuse**

In futuro l'app potrebbe anche riconoscere workflow ripetitivi e suggerire:

> “You use this workflow often. Create a reusable skill?”

---

### Personal Capability Library

Ogni utente dovrebbe avere una propria libreria composta da:

- capability installate;
    
- capability create personalmente;
    
- capability preferite;
    
- capability specifiche dei progetti;
    
- capability suggerite;
    
- capability recentemente utilizzate.
    

Questo può diventare progressivamente il **profilo operativo personale dell'utente**.

---

### Trust & Permissions

Skills e plugin devono essere trattati diversamente (a livello di sicurezza).

#### Skills

Generalmente a basso rischio:

- modificano il comportamento/instructions dell'agente;
    
- possono essere attivate rapidamente.
    

#### Extensions / Plugins

Richiedono maggiore attenzione.

La UI deve mostrare chiaramente:

- publisher;
    
- source code availability;
    
- accesso al repository;
    
- command execution;
    
- network access;
    
- altre permission richieste.
    

Le capability eseguibili non devono essere installate automaticamente sulla sola raccomandazione dell'AI.

---

### Marketplace philosophy

Non costruire un semplice “App Store”, ma comunque fornire un markeplace dove poter esplorare le capabilities.

Organizzare il discovery principalmente per obiettivo:

- Build UI
    
- Debug
    
- Test
    
- Review
    
- Security
    
- Database
    
- Git & Release
    
- DevOps
    
- Documentation
    
- Planning
    

Possibile sezione:

#### Recommended for this repository

basata automaticamente sullo stack e sul contesto del progetto.

---

### Long-term intelligence

Nel tempo l'app potrebbe imparare quali capability funzionano meglio:

- per repository;
    
- per tipo di task;
    
- per coding agent;
    
- per stack tecnologico.
    

Segnali utili:

- task completato;
    
- test passati;
    
- review approvata;
    
- PR merged;
    
- modifiche richieste;
    
- capability mantenuta/rimossa dall'utente.
    

Questo può alimentare raccomandazioni sempre più utili e personali.

---

### Possibile identità della feature

Non:

> “Install extensions from chat.”

Ma:

> **Capability-aware coding sessions.**

Ogni unità di lavoro diventa:

**Task + Worktree + Agent + Capabilities + Conversation**

La chat diventa il punto in cui l'utente:

- assegna il lavoro;
    
- sceglie l'agente;
    
- potenzia l'agente;
    
- osserva quali capacità vengono utilizzate;
    
- salva nuovi workflow riutilizzabili.
