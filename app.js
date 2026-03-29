ZOHO.embeddedApp.on("PageLoad", async function (data) {

    /* =======================
       Utils
    ======================= */
    const $ = id => document.getElementById(id);
    const show = (id, flag) => {
        const el = $(id);
        if (!el) return;
        el.classList.toggle("hidden", !flag);
    };
    const dec2 = n => {
        const v = parseFloat(n);
        return isNaN(v) ? 0 : parseFloat(v.toFixed(2));
    };

    /* =======================
       DRAG & DROP
    ======================= */
    function initDropzones() {
        document.querySelectorAll(".dropzone").forEach(zone => {
            const input = zone.querySelector("input[type='file']");
            const list = zone.querySelector(".file-list");

            zone.addEventListener("click", () => input.click());
            zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dragover"); });
            zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));

            zone.addEventListener("drop", e => {
                e.preventDefault();
                zone.classList.remove("dragover");

                const dt = new DataTransfer();
                if (input.files && input.files.length > 0) {
                    for (const f of input.files) dt.items.add(f);
                }
                for (const f of e.dataTransfer.files) dt.items.add(f);
                input.files = dt.files;
                updateList();
            });

            input.addEventListener("change", updateList);

            function updateList() {
                list.innerHTML = "";
                if (!input.files) return;
                [...input.files].forEach(file => {
                    const div = document.createElement("div");
                    div.textContent = file.name;
                    list.appendChild(div);
                });
            }
        });
    }
    initDropzones();

    /* =======================
       MULTI-TAGS
    ======================= */
    const tagEls = document.querySelectorAll("#Avantages_container .multi-option");

    tagEls.forEach(opt => {
        opt.addEventListener("click", () => {
            opt.classList.toggle("selected");
            const selected = [...document.querySelectorAll(".multi-option.selected")].map(o => o.dataset.value);
            $("Avantages_sociaux").value = JSON.stringify(selected);
        });
    });

    /* =======================
       Conditionnels
    ======================= */
    $("EIMT_anterieure").onchange = () =>
        show("grp_eimt_pdf", $("EIMT_anterieure").value === "Oui");

    $("Description_poste_existe").onchange = () =>
        show("grp_desc_pdf", $("Description_poste_existe").value === "Oui");

    $("Heures_sup").onchange = () =>
        show("grp_taux_hs", $("Heures_sup").value === "Oui");

    $("Regime_retraite").onchange = () =>
        show("grp_regime_retraite", $("Regime_retraite").value === "Oui");

    $("Travail_partage").onchange = () =>
        show("grp_travail_partage", $("Travail_partage").value === "Oui");

    /* =======================
       Nouvelle logique TET
    ======================= */
    function updateTETLogic() {
        const n = parseInt($("Nb_TET_vises").value || "0", 10);
        const choix = $("Tous_meme_salaire").value;

        show("q10", false);
        show("grp_salaire_unique", true);
        show("grp_liste_tet", false);

        if (n > 1) {
            show("q10", true);
            show("grp_salaire_unique", false);

            if (choix === "Oui") {
                show("grp_salaire_unique", true);
                show("grp_liste_tet", false);
            }
            if (choix === "Non") {
                show("grp_liste_tet", true);
                show("grp_salaire_unique", false);
                rebuildRows();
            }
        }
    }

    $("Nb_TET_vises").oninput = updateTETLogic;
    $("Nb_TET_vises").onchange = updateTETLogic;
    $("Tous_meme_salaire").onchange = updateTETLogic;
    updateTETLogic();

    /* =======================
       TABLEAU TET
    ======================= */
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

    /* =======================
       Prefill Matter
    ======================= */
    let matterId = data?.EntityId || null;

    if (!matterId) {
        try {
            const ctx = await ZOHO.CRM.UI.Record.get({ Entity: "Matters" });
            matterId = ctx?.data?.Id || null;
        } catch (e) {}
    }

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
                        prenom: t.Prénom || "",
                        nom: t.Nom || "",
                        salaire: t.Salaire_horaire || "",
                    });
                }

                if (pre.length) {
                    $("Tous_meme_salaire").value = "Non";
                    $("Nb_TET_vises").value = pre.length;
                    updateTETLogic();
                    rebuildRows(pre);
                }
            }
        } catch (e) {}
    }

    /* =======================
       SOUMISSION
    ======================= */
    $("btn_submit").onclick = async () => {
        $("msg").textContent = "Traitement...";

        /* PAYLOAD CRM — version corrigée avec VRAIS API NAMES */
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

            Avantages_sociaux: JSON.parse($("Avantages_sociaux").value || "[]"),
            Avantages_sociaux_details: $("Avantages_details").value || "",

            Regime_retraite: $("Regime_retraite").value,
            Regime_retraite_details: $("Description_regime_retraite").value || "",

            Informations_complementaires: $("Informations_complementaires").value || "",

            Questionnaire_statut: "Soumis",

            /* CHAMPS RÉELS CRM */
            No_ARC: $("ARC").value || "",
            NEQ: $("NEQ").value || "",
            Nb_employes_ARC_recu: parseInt($("Nb_employes_ARC").value || "0", 10),
            Revenu_gt_5M_recu: $("Revenus_5M").value,
            Travail_partage_existe: $("Travail_partage").value,
            Travail_partage_details: $("Travail_partage_details").value || ""
        };

        /* GESTION SALAIRES */
        if (payload.Nb_TET_vises === 1 || payload.Tous_meme_salaire === "Oui") {
            payload.Salaire_horaire_unique = dec2($("Salaire_horaire_unique").value);
        } else if (payload.Tous_meme_salaire === "Non") {
            const rows = [];
            document.querySelectorAll("#tbl_body tr").forEach(tr => {
                rows.push({
                    Pr_nom_du_Travailleur: tr.querySelector(".r_prenom").value.trim(),
                    Nom_du_Travailleur: tr.querySelector(".r_nom").value.trim(),
                    Salaire_horaire: dec2(tr.querySelector(".r_sal").value),
                });
            });
            payload.Liste_TET = rows;
        }

        /* INSERT CRM */
        try {
            const ins = await ZOHO.CRM.API.insertRecord({
                Entity: "PRE_EIMT",
                APIData: [payload],
            });

            if (ins?.data?.[0]?.code === "SUCCESS") {
                $("msg").textContent = "Soumis avec succès!";
                alert("Soumis.");
            } else {
                $("msg").textContent = "Erreur de création.";
                console.error(ins);
            }
        } catch (e) {
            $("msg").textContent = "Erreur inattendue.";
            console.error(e);
        }
    };
});

/* WebTab requirement */
ZOHO.embeddedApp.init();
