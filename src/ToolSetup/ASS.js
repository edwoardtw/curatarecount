import { userConfig, ensureRemoteConfigsUpdated } from '/twcheese/src/Util/Config.js';
import { initCss } from '/twcheese/src/Util/UI.js';
import { suggestRedirect } from '/twcheese/src/Prompt/suggestRedirect.js';
import {
    scrapeScavengeModels,
    scrapeAvailableTroopCounts,
    scrapeUsableOptionIds
} from '/twcheese/src/Scrape/scavenge.js';
import { troopUtil } from '/twcheese/src/Models/Troops.js';
import { ScavengeTroopsAssigner } from '/twcheese/src/Models/ScavengeTroopsAssigner.js';
import { ProcessFactory } from '/twcheese/src/Models/Debug/Build/ProcessFactory.js';
import { processCfg as debugCfgDefault } from '/twcheese/dist/tool/cfg/debug/ASS/Default.js';



let initialized = false;
let troopsAssigner;

async function useTool() {
    if (!atScavengeScreen()) {
        suggestRedirectToScavengeScreen();
        return;
    }

    if (!initialized) {
        await init();
        initialized = true;
    }

    prepareBestOption();
}


async function init() {
    await ensureRemoteConfigsUpdated();

    let { options, sendableTroopTypes } = scrapeScavengeModels(document);
    troopsAssigner = new ScavengeTroopsAssigner(options, sendableTroopTypes, troopUtil);

    // todo: configure troopsAssigner

    initCss(`
        .free_send_button:focus {
            color: yellow;
            box-shadow: 0 0 5px 3px yellow;
        }
    `);

    afterScavengingStarted(() => prepareBestOption(false));
}


function atScavengeScreen() {
    let here = document.location.href;
    return here.includes('screen=place') && here.includes('mode=scavenge');
}


function suggestRedirectToScavengeScreen() {
    suggestRedirect({
        message: 'To use this, you must be at the scavenging screen.',
        screen: 'place',
        screenName: 'Scavenging Screen',
        uriParams: {
            mode: 'scavenge'
        },
        skippableId: 'Tool:ASS'
    });
}


function prepareBestOption(informUserOfIssues = true) {
    let usableOptionIds = scrapeUsableOptionIds(document);
    if (usableOptionIds.length < 1) {
        if (informUserOfIssues) {
            window.UI.ErrorMessage(`Can't scavenge with this village right now`);
        }        
        return;
    }

    let availableTroops = scrapeAvailableTroopCounts(document);
    if (availableTroops.sum() < 1) { // todo: check at least 10 usable pop available according to assigner preferences
        if (informUserOfIssues) {
            window.UI.ErrorMessage(`Not enough troops available to scavenge right now`);
        }
        return;
    }
    
    let haulFactor = 1.0; // todo: actual factor
    let assignedTroopsByOption = troopsAssigner.assignTroops(usableOptionIds, availableTroops, haulFactor);

    let optionId = usableOptionIds[usableOptionIds.length - 1];
    fillTroops(assignedTroopsByOption.get(optionId));
    focusStartButton(optionId);
}


function focusStartButton(optionId) {
    $('.free_send_button')[optionId - 1].focus();
}


function fillTroops(troopCounts) {
    console.log('filling', troopCounts);
    troopCounts.each(function(troopType, count) {
        $(`.unitsInput[name='${troopType}']`)
            .val(count)
            .trigger('change');
    });
}


function afterScavengingStarted(doSomething) {
    let observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            let didScavengingStart = $(mutation.addedNodes).is('.active-view');
            if (didScavengingStart) {
                doSomething();
            }
        });
    });
    
    $('.scavenge-option').each(function() {
        observer.observe(this, {
            childList: true,
            subtree: true
        });
    });
}


// register tool ///////////////////////////////////////////////////////

let processFactory = new ProcessFactory({});

function newDebugProcess() {
    let name = 'Tool: Another Scavenging Script';
    return processFactory.create(name, debugCfgDefault, true);
}


window.TwCheese.registerTool({
    id: 'ASS',
    use: useTool,
    getDebugProcess: newDebugProcess
});