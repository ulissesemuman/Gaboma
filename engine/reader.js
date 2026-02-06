export function renderCurrentChapter(buttons) {
    setBottomBar([  
        {   
        id: "home", 
        label: t("ui.home"), 
        onClick: () => {
            openLibrary();
        }       
            
        },  
        {   
        id: "config", 
        label: t("ui.config"), 
        onClick: openConfigPopup 
        }       
    ]);     
}