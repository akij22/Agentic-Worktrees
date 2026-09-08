# Cross-worktree conflicts: evoluzione del prodotto

## Contesto

La pagina **Cross-worktree conflicts** individua sovrapposizioni ad alto o medio rischio tra worktree gestite da coding agent differenti. L'implementazione attuale possiede già alcune fondamenta importanti:

- identifica le worktree e le sessioni agente coinvolte;
- confronta le modifiche prodotte dalle due worktree;
- permette di aprire separatamente le rispettive chat;
- può confermare il rischio tramite Git senza modificare le worktree originali;
- per i casi che richiedono revisione conserva una worktree d'integrazione isolata;
- il workspace dei coding agent supporta già due chat affiancate.

Manca però un workflow che trasformi queste primitive in una vera risoluzione assistita. L'apertura di una chat non trasferisce il contesto del conflitto, i due agenti non possono coordinarsi attraverso un oggetto condiviso e la worktree d'integrazione non è ancora governata da un processo di risoluzione, verifica e pubblicazione.

L'opportunità è trasformare la pagina da semplice segnalatore a un ambiente nel quale persone e agenti possano comprendere le rispettive intenzioni, negoziare una soluzione e applicarla in sicurezza.

## Visione: la Conflict Room

La feature principale dovrebbe essere una **Conflict Room**, uno spazio temporaneo dedicato a un singolo conflitto cross-worktree.

L'azione primaria della pagina diventerebbe:

> Resolve with agents

La Conflict Room riunirebbe:

- le due chat coinvolte, affiancate;
- un dossier condiviso del conflitto;
- gli intenti e i vincoli dichiarati dai due agenti;
- un piano di risoluzione approvabile;
- lo stato delle attività assegnate;
- una vista per-file del risultato proposto;
- la diff della worktree d'integrazione;
- le verifiche tecniche e semantiche;
- i controlli finali di pubblicazione.

Il flusso ideale sarebbe:

```text
Conflitto rilevato
      ↓
Conferma tramite Git
      ↓
Raccolta delle intenzioni dei due agenti
      ↓
Piano di risoluzione proposto
      ↓
Approvazione dell'utente
      ↓
Applicazione nella worktree d'integrazione
      ↓
Test e review incrociata
      ↓
Commit, PR o trasferimento controllato della soluzione
```

## Collegamento intelligente con le chat

### 1. Conflict Brief automatico e revisionabile

Quando l'utente collega una chat al conflitto, il sistema prepara un messaggio strutturato contenente:

- agente, task e branch della controparte;
- file, simboli e linee coinvolte;
- target branch e base comune;
- classificazione statica e risultato della simulazione Git;
- sintesi del diff dell'altro agente;
- intenti già raccolti;
- vincoli da non violare;
- attività richiesta all'agente;
- collegamento per tornare alla Conflict Room.

Il messaggio deve essere mostrato in anteprima e modificabile prima dell'invio. Non dovrebbe esistere un'iniezione invisibile di prompt nelle conversazioni.

### 2. Ask both agents

Un singolo comando invia ai due agenti domande complementari:

- Quale comportamento stavi cercando di introdurre?
- Quali parti della tua modifica sono indispensabili?
- Quali parti possono essere adattate o rimosse?
- Quali API o invarianti devono rimanere stabili?
- Quali test descrivono il risultato corretto?
- Quale compromesso proporresti conoscendo il lavoro dell'altro agente?

Le risposte vengono sintetizzate in una sezione **Intent & constraints**, mantenendo sempre accessibile il testo originale. In questo modo il prodotto ragiona sugli obiettivi, non soltanto sulle differenze testuali.

### 3. Link bidirezionali e Conflict Card

In entrambe le chat dovrebbe comparire una card persistente con:

- stato del conflitto: `waiting`, `negotiating`, `resolving`, `validating` o `resolved`;
- task e agente della controparte;
- file ancora irrisolti;
- decisioni che interessano direttamente quella worktree;
- attività assegnata all'agente;
- pulsante **Open Conflict Room**.

Il conflitto diventerebbe un oggetto condiviso e riconoscibile, anziché un dettaglio disperso nella cronologia delle conversazioni.

### 4. Messaggistica coordinata

Dalla Conflict Room l'utente potrebbe scegliere:

- **Send to left**;
- **Send to right**;
- **Send to both**;
- **Ask for alternatives**;
- **Request review from other agent**;
- **Ask for a minimal-change proposal**.

Ogni invio dovrebbe mostrare destinatari, contenuto e contesto allegato. L'utente deve poter evitare l'invio a un agente occupato o l'assegnazione accidentale di istruzioni incompatibili.

### 5. Conflict handoff

Se una sessione è terminata, non disponibile o contiene troppo contesto, il sistema potrebbe creare una nuova sessione nella stessa worktree con un handoff compatto:

- obiettivo originale;
- lavoro già completato;
- decisioni rilevanti;
- conflitto attuale;
- vincoli emersi;
- attività richiesta.

La nuova sessione resterebbe esplicitamente collegata sia alla chat originale sia alla Conflict Room.

### 6. Modalità dual-chat contestuale

Il prodotto supporta già due chat affiancate. La Conflict Room dovrebbe aprire direttamente le due sessioni coinvolte, senza richiedere una selezione manuale della seconda chat.

Tra i due pannelli potrebbe esistere una barra contestuale condivisa con:

- file o decisione attualmente selezionata;
- stato di ciascun agente;
- prompt coordinati pronti all'uso;
- indicatore delle risposte ancora mancanti;
- comando per confrontare le due proposte.

## Risoluzione dei conflitti

### 7. Integration Agent dedicato

La modalità più sicura sarebbe introdurre un terzo agente con ruolo **Resolver**, eseguito esclusivamente nella worktree d'integrazione conservata dalla simulazione.

Il Resolver:

- non modifica mai le due worktree originali;
- legge il dossier del conflitto e le risposte dei due agenti;
- propone un piano prima di modificare file;
- risolve un file o un gruppo coerente alla volta;
- registra le motivazioni delle decisioni;
- esegue le verifiche approvate;
- produce un riepilogo finale.

L'utente potrebbe selezionare una strategia:

- **Conservative**: preserva entrambi i comportamenti quando possibile;
- **Target-first**: privilegia compatibilità e convenzioni del target branch;
- **Intent-first**: ricostruisce la soluzione partendo dagli obiettivi dichiarati;
- **Minimal diff**: riduce al minimo le modifiche aggiuntive;
- **API stability**: evita cambiamenti ai contratti pubblici salvo approvazione esplicita.

### 8. Semantic Resolution Studio

Per ogni file il prodotto dovrebbe mostrare:

- base comune;
- versione sinistra;
- versione destra;
- risultato proposto nella worktree d'integrazione.

Oltre alle azioni tradizionali `Keep left` e `Keep right`, servono azioni semantiche:

- **Combine both intents**;
- **Preserve API from left**;
- **Preserve behavior from right**;
- **Ask agents to negotiate**;
- **Generate alternative**;
- **Edit manually**.

La vista dovrebbe riconoscere e spiegare casi come:

- stessa firma di funzione modificata in modi incompatibili;
- schema dati evoluto in due direzioni;
- rename contro modifica;
- dipendenze aggiornate a versioni differenti;
- test che descrivono aspettative opposte;
- cambiamenti separati che compilano individualmente ma non insieme.

### 9. Resolution Plan approvabile

Prima di modificare il codice, il sistema presenta un piano, ad esempio:

1. Conservare il nuovo contratto API dell'agente sinistro.
2. Adattare l'implementazione dell'agente destro al nuovo contratto.
3. Unificare i test duplicati.
4. Aggiornare i call site interessati.
5. Eseguire typecheck e test mirati.

Ogni passaggio mostra motivazione, file interessati, livello di rischio, agente proponente e verifiche attese. L'utente può approvare il piano completo, modificarne singoli punti o chiedere alternative.

### 10. Risoluzione incrementale con checkpoint

Ogni file dovrebbe attraversare stati espliciti:

- `Unresolved`;
- `Proposed`;
- `Accepted`;
- `Validated`;
- `Needs reconsideration`.

Ogni decisione accettata crea un checkpoint recuperabile nella worktree d'integrazione. L'utente può annullare un singolo passaggio senza perdere il resto del lavoro. Commit temporanei o snapshot interni dovrebbero restare dettagli del main process e non essere esposti come complessità operativa nella UI.

### 11. Validation Gate

La scomparsa dei marker Git non è sufficiente per dichiarare risolto un conflitto. La Conflict Room dovrebbe distinguere:

- **Textually resolved**;
- **Build passes**;
- **Tests pass**;
- **Intent verified**;
- **Ready to integrate**.

Il sistema suggerisce i controlli rilevanti in base ai file modificati e alle convenzioni del repository. Per ogni controllo mostra comando, motivazione, stato, durata, output sintetico e collegamento ai dettagli in caso di errore.

I comandi devono essere approvabili e gestiti dal main process, con cancellazione, timeout, ownership del processo e redazione delle informazioni sensibili.

### 12. Contro-review tra agenti

Dopo la proposta del Resolver:

- l'agente sinistro verifica che il proprio intento sia preservato;
- l'agente destro esegue la stessa verifica;
- le obiezioni diventano una checklist strutturata;
- il Resolver produce una nuova versione soltanto per i punti contestati.

La review deve chiedere agli agenti di verificare il comportamento, non di difendere automaticamente il proprio diff.

### 13. Alternative confrontabili

Per i conflitti più rischiosi il Resolver potrebbe proporre due o tre soluzioni alternative, ognuna con:

- diff stimata;
- compromessi;
- rischio di regressione;
- test richiesti;
- impatto sui due intenti;
- costo di manutenzione previsto.

L'utente potrebbe confrontarle e promuoverne una nella worktree d'integrazione.

## Prevenzione dei conflitti

### 14. Intent Map live

Mentre gli agenti lavorano, il sistema potrebbe estrarre una mappa leggera di:

- file che prevedono di modificare;
- simboli principali;
- API che intendono cambiare;
- test che intendono aggiungere;
- dipendenze o schemi condivisi coinvolti.

Quando due intenzioni convergono, nelle chat compare un avviso preventivo:

> Another agent is modifying the same IPC contract. Coordinate now?

Il warning dovrebbe essere consultivo e ignorabile, senza introdurre lock rigidi che rallentino il lavoro.

### 15. Soft ownership temporaneo

Un agente può dichiarare vincoli temporanei come:

- sto cambiando questo contratto;
- questa firma deve restare stabile;
- questo file è modificabile, ma questo comportamento non lo è;
- sto aspettando una decisione prima di procedere.

Gli altri agenti ricevono tali informazioni nel proprio contesto prima di iniziare una modifica sovrapposta.

### 16. Preflight prima di una nuova attività

Quando viene inviato un prompt che probabilmente interesserà aree già attive, il composer potrebbe mostrare:

- worktree potenzialmente sovrapposte;
- agenti attualmente occupati sugli stessi moduli;
- contratti condivisi coinvolti;
- suggerimento di coordinamento o suddivisione del task.

L'utente può comunque procedere, modificare il prompt o aprire una conversazione di coordinamento.

### 17. Conflict Memory

Dopo ogni risoluzione il sistema conserva un playbook locale con:

- strategia scelta;
- decisioni accettate;
- test determinanti;
- pattern ricorrenti;
- moduli che confliggono spesso;
- preferenze esplicitamente approvate dall'utente.

In futuro potrebbe suggerire, per esempio:

> In questo repository i conflitti sul contratto IPC vengono normalmente risolti mantenendo il tipo condiviso e adattando entrambi i consumer.

La memoria deve essere consultabile, correggibile e disattivabile. Non dovrebbe generare automaticamente una nuova dashboard.

## Pubblicazione sicura

Al termine della risoluzione, la Conflict Room dovrebbe offrire azioni esplicite:

- **Create integration commit**;
- **Create branch**;
- **Open pull request**;
- **Copy patch**;
- **Apply to one worktree**;
- **Keep sandbox for later**;
- **Discard sandbox**.

Nessuna soluzione dovrebbe essere applicata automaticamente alle worktree originali. Prima di ogni operazione mutativa vanno mostrati repository, percorso della worktree, branch, commit, file interessati e conseguenze previste.

## Prima implementazione consigliata

### Obiettivo

Come prima implementazione realizzerei un MVP della **Conflict Room guidata**, senza introdurre subito un Resolver autonomo o un merge editor completo.

L'obiettivo sarebbe collegare realmente conflitto e conversazioni, rendere espliciti gli intenti e guidare l'utente fino alla worktree d'integrazione. Questa scelta offre valore immediato riutilizzando capacità già presenti e limita il rischio di modifiche automatiche non sufficientemente governate.

### Esperienza utente dell'MVP

1. L'utente seleziona un conflitto e lo conferma tramite Git.
2. Se il caso richiede revisione, compare **Open Conflict Room**.
3. La Conflict Room apre direttamente le due sessioni coinvolte in modalità dual-chat.
4. Un pannello centrale o laterale mostra il Conflict Brief condiviso.
5. L'utente preme **Ask both agents** e revisiona i due messaggi prima dell'invio.
6. Le risposte vengono registrate come intenti e vincoli associati al conflitto.
7. Il sistema genera un piano di risoluzione testuale, anch'esso revisionabile.
8. L'utente può inviare il piano a entrambi gli agenti per una contro-review.
9. Dopo l'approvazione, l'utente apre la worktree d'integrazione nell'editor e usa checklist e dossier come guida.
10. La Conflict Room rimane il punto unico dal quale seguire chat, decisioni e stato per file.

### Scope funzionale

Includerei:

- deep link dalla pagina conflitti alle due chat già selezionate;
- identificatore persistente della Conflict Room collegato alla sessione di risoluzione esistente;
- Conflict Brief generato da evidenze, participant e diff già disponibili;
- anteprima e modifica del messaggio prima di ogni invio;
- invio coordinato a sinistra, destra o entrambi;
- acquisizione esplicita delle risposte come `intent`, `constraint` o `proposal`;
- checklist per-file con stato manuale;
- piano di risoluzione testuale revisionabile;
- link bidirezionale nelle chat;
- apertura della integration worktree esistente;
- stato persistito della room e ripristino dopo il riavvio dell'applicazione.

Non includerei ancora:

- scrittura automatica del codice da parte di un terzo Resolver;
- applicazione automatica alle worktree originali;
- merge editor proprietario completo;
- Conflict Memory cross-session;
- soft ownership e prevenzione live;
- pubblicazione automatica di commit o pull request.

### Struttura UI minima

La pagina attuale rimarrebbe densa e operativa. Non aggiungerei una nuova voce di navigazione permanente. La Conflict Room sarebbe raggiungibile solo da un conflitto concreto o dalla relativa card in chat.

La vista conterrebbe:

- header con repository, target branch, stato e rischio;
- dual chat con le due sessioni pre-selezionate;
- pannello richiudibile **Conflict dossier**;
- tab `Evidence`, `Intent`, `Plan` e `Files`;
- barra azioni con `Ask both`, `Send`, `Open integration worktree` e `Mark resolved`;
- indicatori chiari per sessioni assenti, agenti occupati ed errori di invio.

### Modello dati iniziale

Estenderei il concetto esistente di sessione di risoluzione con dati di orchestrazione separati dalle entità Git:

- stato della room;
- brief e sua versione;
- messaggi coordinati con destinatari e stato di invio;
- intenti, vincoli e proposte estratti o confermati;
- piano corrente e storico minimo delle revisioni;
- checklist per-file;
- riferimenti ai messaggi delle chat, senza duplicare l'intera conversazione.

I contratti condivisi dovrebbero esporre DTO specifici e non entità del database.

### Architettura proposta

Seguendo l'architettura Electron del progetto:

- il **renderer** renderizza la room, prepara le anteprime e raccoglie le decisioni dell'utente;
- il **preload** espone API ristrette e tipizzate;
- il **main process** valida ogni payload, compone il dossier, invia i messaggi agli agenti e persiste lo stato;
- un servizio dedicato di orchestrazione coordina conflict session e coding-agent session senza spostare logica Git nel renderer;
- i nomi dei canali e i contratti IPC rimangono centralizzati;
- gli handler IPC restano sottili e delegano ai servizi;
- gli errori di un destinatario non vengono nascosti se l'invio all'altro ha successo.

Possibili capability IPC, da affinare durante la progettazione:

- ottenere il dossier di una room;
- creare o aggiornare il brief;
- preparare l'anteprima di un messaggio coordinato;
- confermare l'invio a uno o più partecipanti;
- registrare un intento o un vincolo;
- aggiornare piano e checklist;
- sottoscrivere gli eventi della room.

Eviterei un canale generico capace di eseguire comandi o inviare payload arbitrari.

### Sicurezza e controllo

- Nessun messaggio viene inviato senza conferma esplicita nell'MVP.
- Nessuna modifica viene applicata automaticamente alle worktree originali.
- I riferimenti alle directory locali non vengono inseriti nei messaggi se non necessari.
- Lo stato `busy`, `waiting_permission`, `error` o sessione assente viene mostrato prima dell'invio.
- La room registra chi ha proposto e chi ha approvato ogni decisione.
- Un refresh delle evidenze avvisa l'utente se i diff sono cambiati e il brief è diventato obsoleto.

### Criteri di successo

L'MVP è efficace se permette di:

- passare dal conflitto alle due chat in un solo gesto;
- evitare di copiare manualmente file, diff e contesto tra conversazioni;
- ottenere da entrambi gli agenti una descrizione confrontabile dell'intento;
- conservare decisioni e piano anche dopo la chiusura dell'app;
- aprire la worktree d'integrazione con un dossier operativo completo;
- sapere chiaramente cosa resta da decidere prima di dichiarare risolto il caso.

### Verifiche necessarie

La prima implementazione richiederebbe test focalizzati su:

- validazione dei nuovi contratti IPC;
- autorizzazione e instradamento dei messaggi verso i run corretti;
- invio parzialmente riuscito a due agenti;
- persistenza e ripristino della room;
- rilevazione di evidenze diventate obsolete;
- apertura dual-chat con entrambi i run corretti;
- preview e conferma prima dell'invio;
- stati vuoti per sessioni mancanti o terminate;
- accessibilità tramite tastiera e focus tra chat e dossier.

## Evoluzione successiva

Dopo aver validato l'MVP procederei in questo ordine:

1. Integration Agent dedicato con piano approvabile.
2. Validation Gate con comandi suggeriti e verifiche tracciate.
3. Resolution Studio per-file e checkpoint recuperabili.
4. Contro-review automatizzata tra i due agenti.
5. Creazione controllata di commit, branch o pull request.
6. Intent Map preventiva e soft ownership.
7. Conflict Memory locale e correggibile.

Il principale elemento differenziante non sarebbe un altro merge editor, ma la capacità di coordinare agenti sulla base dell'intento, conservando controllo umano, isolamento Git e tracciabilità delle decisioni.
