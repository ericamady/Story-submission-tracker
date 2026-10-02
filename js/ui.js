document.addEventListener('DOMContentLoaded',()=>{
    //initialize the mobile navigation menu
    const mobileMenu = document.querySelector('#mobile-menu');
    M.Sidenav.init(mobileMenu,{
        edge:'right'


    });
    //initialize the market side form
    const marketForm = document.querySelector('#market-form');
    M.Sidenav.init(marketForm,{
        edge:'left'


    });
    //initialize select market fields
    const selectFields = document.querySelectorAll('select');
    M.FormSelect.init(selectFields);
    const addmarketForm = document.querySelector('#add-market-form');
    addmarketForm.addEventListener('submit', (event)=>{
        event.preventDefault()
        M.toast({
            html: 'Market form is ready.'
        });
    })

     //initialize the story side form
    const storyForm = document.querySelector('#story-form');
    M.Sidenav.init(storyForm,{
        edge:'left'


    });
    //initialize select story fields
    const selectStoryFields = document.querySelectorAll('select');
    M.FormSelect.init(selectStoryFields);
    const addStoryForm = document.querySelector('#add-story-form');
    addStoryForm.addEventListener('submit', (event)=>{
        event.preventDefault()
        M.toast({
            html: 'Story form is ready.'
        });
    })


     //initialize the tracker side form
    const trackerForm = document.querySelector('#tracker-form');
    M.Sidenav.init(trackerForm,{
        edge:'left'


    });
    //initialize select story fields
    const trackerFields = document.querySelectorAll('select');
    M.FormSelect.init(trackerFields);
    const trackerFieldForm = document.querySelector('#add-tracker-form');
    trackerFieldForm.addEventListener('submit', (event)=>{
        event.preventDefault()
        M.toast({
            html: 'Tracker form is ready.'
        });
    })
        
});