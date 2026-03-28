ZOHO.embeddedApp.on("PageLoad", async function (data) {

    /* ============================================================
       Utils
    ============================================================ */
    const $ = (id) => document.getElementById(id);

    const show = (id, flag) => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle("hidden", !flag);
    };

    const dec2 = (n) => {
        const v = parseFloat(n);
        return isNaN(v) ? 0 : parseFloat(v.toFixed(2));
    };

    /* ============================================================
       DRAG & DROP — MULTI-FICHIERS AVEC FUSION
    ============================================================ */
    function initDropzones() {
        document.querySelectorAll(".dropzone").forEach(zone => {

            const input = zone.querySelector("input[type='file']");
            const list = zone.querySelector(".file-list");

            // Clic → filepicker
            zone.addEventListener("click", () => input.click());

            // Drag visual
            zone.addEventListener("dragover", (e) => {
                e.preventDefault();
                zone.classList.add("dragover");
            });

            zone.addEventListener("dragleave", () => {
                zone.classList.remove("dragover");
            });

            // Drop avec fusion
            zone.addEventListener("drop", (e) => {
                e.preventDefault();
                zone.classList.remove("dragover");

                const dt = new DataTransfer();

                // Fichiers déjà présents
                if (input.files && input.files.length > 0) {
                    for (const f of input.files) dt.items.add(f);
                }

                // Nouveaux fichiers
                for (const f of e.dataTransfer.files) dt.items.add(f);

                input.files = dt.files;

                updateList();
            });

            input.addEventListener("change", updateList);

            function updateList() {
                list.innerHTML = "";
                if (!input.files) return;

                [...input.files].forEach(file => {
                    const d = document.createElement("div");
                    d.textContent = file.name;
                    list.appendChild(d);
                });
            }
        });
    }

    initDropzones();


    /* ============================================================
       Conditionnels
    ============================================================ */

    // 1–2 : Déjà une EIMT ?
    $("EIMT_anterieure").onchange = () =>
        show("grp_eimt_pdf", $("EIMT_anterieure").value === "Oui");

    // 3–4 : Description du poste
    $("Description_poste_existe").onchange = () =>
        show("grp_desc_pdf", $("Description_poste_existe").value === "Oui");

    // 10–12 : même salaire ?
    $("Tous_meme_salaire").onchange = () => {
        const val = $("Tous_meme_salaire").value;
        const n = parseInt($("Nb_TET_vises").value || "0", 10);

        if (n === 1) {
            // Cas spécial « un seul travailleur »
            show("grp_salaire_unique", true);
            show("grp_liste_tet", false);
            return;
        }

        if (val === "Oui") {
            show("grp_salaire_unique", true);
            show("grp_liste_tet", false);
        } else if (val === "Non") {
            show("grp_salaire_unique", false);
            show("grp_liste_tet", true);
            rebuildRows();
        } else {
            show("grp_salaire_unique", false);
            show("grp_liste_tet", false);
        }
    };

    // 13–14 : heures sup
    $("Heures_sup").onchange = () =>
        show("grp_taux_hs", $("Heures_sup").value === "Oui");

    // 19–20 : régime de retraite
    $("Regime_retraite").onchange = () =>
        show("grp_regime_retraite", $("Regime_retraite").value === "Oui");

    // 24–25 : travail partagé
    $("Travail_partage").onchange = () =>
        show("grp_travail_partage", $("Travail_partage").value === "Oui");


    /* ============================================================
       Cas spécial : Nb travailleurs (1 travailleur = logique réduite)
    ============================================================ */
    $("Nb_TET_vises").oninput = () => {

        const n = parseInt($("Nb_TET_vises").value || "0", 10);

        if (n === 1) {
            // Masquer Q10 (Tous même salaire)
            show("Tous_meme_salaire", false);

            // Forcer mode salaire unique
            show("grp_salaire_unique", true);
            show("grp_liste_tet", false);

        } else {
            // Affichage normal
            show("Tous_meme_salaire", true);

            if ($("Tous_meme_salaire").value === "Non") {
                show("grp_liste_tet", true);
                rebuildRows();
            } else if ($("Tous_meme_salaire").value === "Oui") {
                show("grp_salaire_unique", true);
            }
        }
    };


    /* ============================================================
       Tableau dynamique TET
    ============================================================ */
    const body = $("tbl_body");

    function rebuildRows(prefill = []) {
        const n = Math.max(0, parseInt($("Nb_TET_vises").value || "0", 10));
        body.innerHTML = "";

        for (let i = 0; i < n; i++) {
            const r = document.createElement("tr");

            r.innerHTML = `
                <td><input class="r_prenom"></td>
                <td><input class="r_nom"></td>
                <td><input class="r_sal" type="number" step="0.01"></td>
            `;

            if (prefill[i]) {
                r.querySelector(".r_prenom").value = prefill[i].prenom || "";
                r.querySelector(".r_nom").value = prefill[i].nom || "";
                r.querySelector(".r_sal").value = prefill[i].salaire || "";
            }

            body.appendChild(r);
        }
    }


    /* ============================================================
       Contexte MATTER
    ============================================================ */
    let matterId = data?.EntityId || null;

    if (!matterId) {
        try {
            const ctx = await ZOHO.CRM.UI.Record.get({ Entity: "Matters" });
            matterId = ctx?.data?.Id || null;
        } catch (e) {}
    }


    /* ============================================================
       Préremplissage depuis Matter
    ============================================================ */
    if (matterId) {
        try {
            const resp = await ZOHO.CRM.API.getRecord({
                Entity: "Matters",
                RecordID: matterId,
            });

            const m = resp?.data?.[0];

            if (m) {
                if (m.C_P_lieu_de_travail && !$("CodePostal_LieuTravail").value) {
                    $("CodePostal_LieuTravail").value = m.C_P_lieu_de_travail;
                }

                const info = Array.isArray(m.Info_TET) ? m.Info_TET : [];
                const pre = [];

                for (const t of info) {
                    pre.push({
                        prenom: t.TET_Prenom || "",
                        nom: t.TET_Nom || "",
                        salaire: t.Salaire_horaire || "",
                    });
                }

                if (pre.length) {
                    $("Tous_meme_salaire").value = "Non";
                    show("grp_salaire_unique", false);
                    show("grp_liste_tet", true);
                    $("Nb_TET_vises").value = pre.length;
                    rebuildRows(pre);
                }
            }
        } catch (e) {}
    }


    /* ============================================================
       Soumission
    ============================================================ */
    $("btn_submit").onclick = async () => {

        $("msg").textContent = "Traitement...";

        const listAv = [...$("Avantages_sociaux").selectedOptions].map(o => o.value);

        const payload = {
            Matter: matterId,

            Titre_poste: $("Titre_poste").value || "",
            Nb_TET_vises: parseInt($("Nb_TET_vises").value || "0", 10),
            Renouvellement: $("Renouvellement").value,
            Poste_syndique: $("Poste_syndique").value,

            Adresse_LieuTravail: $("Adresse_LieuTravail").value || "",
            Ville_LieuTravail: $("Ville_LieuTravail").value || "",
            CodePostal_LieuTravail: $("CodePostal_LieuTravail").value || "",

            Tous_meme_salaire: $("Tous_meme_salaire").value,
            Heures_sup: $("Heures_sup").value,
            Vacances_jours: parseInt($("Vacances_jours").value || "0", 10),

            Avantages_sociaux: listAv,
            Avantages_details: $("Avantages_details").value || "",

            Regime_retraite: $("Regime_retraite").value,
            Informations_complementaires: $("Informations_complementaires").value || "",

            Questionnaire_statut: "Soumis"
        };


        /* Salaire unique ou liste */
        if (payload.Nb_TET_vises === 1) {
            payload.Salaire_horaire_unique = dec2($("Salaire_horaire_unique").value);

        } else if ($("Tous_meme_salaire").value === "Oui") {
            payload.Salaire_horaire_unique = dec2($("Salaire_horaire_unique").value);

        } else if ($("Tous_meme_salaire").value === "Non") {
            const rows = [];
            document.querySelectorAll("#tbl_body tr").forEach(tr => {
                rows.push({
                    TET_Prenom: tr.querySelector(".r_prenom").value.trim(),
                    TET_Nom: tr.querySelector(".r_nom").value.trim(),
                    TET_Salaire: dec2(tr.querySelector(".r_sal").value),
                });
            });
            payload.Liste_TET = rows;
        }


        /* Envoi Zoho */
        try {
            const ins = await ZOHO.CRM.API.insertRecord({
                Entity: "PRE_EIMT_Formulaire_1",
                APIData: [payload],
            });

            if (ins?.data?.[0]?.code === "SUCCESS") {
                $("msg").textContent = "Soumis avec succès!";
                alert("Soumis.");
            } else {
                $("msg").textContent = "Erreur lors de la création.";
                console.error(ins);
            }

        } catch (e) {
            $("msg").textContent = "Erreur inattendue.";
            console.error(e);
        }
    };

});


/* Obligatoire pour Web Tab */
ZOHO.embeddedApp.init();
