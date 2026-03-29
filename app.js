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
       1. RÉCUPÉRER PRE_EIMT_ID
    ======================= */
    const preId = data?.EntityId || null;

    if (!preId) {
        console.error("❌ Aucun PRE_EIMT ID reçu dans PageLoad.");
        $("msg").textContent = "Erreur : Aucun questionnaire associé.";
        return;
    }

    /* =======================
       2. CHARGER LE PRE‑EIMT
    ======================= */
    let matterId = null;
    let matterNumber = "";

    try {
        const pre = await ZOHO.CRM.API.getRecord({
            Entity: "PRE_EIMT",
            RecordID: preId
        });

        const preData = pre?.data?.[0];
        if (!preData) throw "Données PRE_EIMT introuvables.";

        matterId = preData?.Matter?.id || null;

    } catch (e) {
        console.error("❌ Erreur chargement PRE_EIMT", e);
        $("msg").textContent = "Erreur lors du chargement du questionnaire.";
        return;
    }

    /* =======================
       3. CHARGER LE MATTER
    ======================= */
    if (matterId) {
        try {
            const m = await ZOHO.CRM.API.getRecord({
                Entity: "Matters",
                RecordID: matterId
            });

            matterNumber = m?.data?.[0]?.Matter_number || "";

        } catch (e) {
            console.error("❌ Erreur chargement Matter", e);
        }
    }

    if ($("Matter_number")) {
        $("Matter_number").value = matterNumber;
    }

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
       MULTI‑TAGS
    ======================= */
    const tagEls = document.querySelectorAll("#Avantages_container .multi-option");

    tagEls.forEach(opt => {
        opt.addEventListener("click", () => {
            opt.classList.toggle("selected");
            const selected = [...document.querySelectorAll(".multi-option.selected")]
                .map(o => o.dataset.value);
            $("Avantages_sociaux").value = JSON.stringify(selected);
        });
    });

    /* =======================
       CONDITIONAL FIELDS
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
       LOGIQUE TET
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
       SUBFORM TET
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
       SOUMISSION DU FORMULAIRE
    ======================= */
    $("btn_submit").onclick = async () => {

        $("msg").textContent = "Traitement...";

        /* ==========
           PAYLOAD CRM
        ========== */
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

            No_ARC: $("ARC").value || "",
            NEQ: $("NEQ").value || "",
            Nb_employes_ARC_recu: parseInt($("Nb_employes_ARC").value || "0", 10),
            Revenu_gt_5M_recu: $("Revenus_5M").value,

            Travail_partage_existe: $("Travail_partage").value,
            Travail_partage_details: $("Travail_partage_details").value || ""
        };

        /* ==========
           SUBFORM
        ========== */
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

        /* =======================
           1. UPDATE PRE_EIMT
        ======================= */
        try {
            const upd = await ZOHO.CRM.API.updateRecord({
                Entity: "PRE_EIMT",
                APIData: [{
                    id: preId,
                    ...payload
                }]
            });

            if (upd?.data?.[0]?.code !== "SUCCESS") {
                $("msg").textContent = "Erreur lors de la mise à jour.";
                console.error(upd);
                return;
            }

        } catch (e) {
            $("msg").textContent = "Erreur inattendue (update).";
            console.error(e);
            return;
        }

        /* ==========================
   2. SYNC PRE → MATTER (Deluge)
=========================== */

try {
    await ZOHO.CRM.FUNCTIONS.execute("SYNC_PRE_TO_MATTER", {
        preId: preId
    });
} catch (e) {
    console.error("Erreur durant la sync PRE → MATTER :", e);
}
        /* =======================
           2. UPLOAD DES FICHIERS
        ======================= */

        async function uploadFiles(inputId, apiFieldName) {
            const input = $(inputId);
            if (!input || !input.files || input.files.length === 0) return;

            for (const file of input.files) {
                try {
                    await ZOHO.CRM.API.uploadFile({
                        Entity: "PRE_EIMT",
                        RecordID: preId,
                        File: file,
                        FileName: file.name,
                        Field: apiFieldName
                    });
                } catch (e) {
                    console.error("❌ Erreur upload fichier", apiFieldName, file.name, e);
                }
            }
        }

        // UPLOAD PAR CHAMP
        await uploadFiles("EIMT_anterieure_pdf", "EIMT_anterieure_pdf");
        await uploadFiles("Description_poste_pdf", "Description_poste_pdf");
        await uploadFiles("Documents_supplementaires", "Documents_supplementaires");

        /* =======================
           3. FIN → MESSAGE
        ======================= */
        $("msg").textContent = "Soumis avec succès!";

        alert("Soumis avec succès.");
    };
});

/* WebTab requirement */
ZOHO.embeddedApp.init();
