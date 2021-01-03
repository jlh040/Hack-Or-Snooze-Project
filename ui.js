$(async function() {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $title = $('#title');
  const $url = $('#url');
  const $author = $('#author');
  const $favoritedArticles = $('#favorited-articles');
  const $profileName = $('#profile-name');
  const $profileUsername = $('#profile-username');
  const $profileAccDate = $('#profile-account-date');

  // global storyList variable
  let storyList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

  $loginForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
    generateFavorites();
    checkForFavorites();
    checkForMyStories();
    addProfileToPage();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

  $createAccountForm.on("submit", async function(evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
    addProfileToPage();
  });

  /**
   * Log Out Functionality
   */

  $navLogOut.on("click", function() {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */

  $navLogin.on("click", function() {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.slideToggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */

  $("body").on("click", "#nav-all", async function() {
    hideElements();
    await generateStories();
    $allStoriesList.show();
  });

  //Allow new posts to be created upon submit
  $submitForm.on('submit', async function(evt) {
    evt.preventDefault();
    if (!($url.val() && $title.val() && $author.val())) {
      return;
    }
    else {
      let newStory = await StoryList.addStory(currentUser, getCreatedStoryValues());
      let storyHTML = generateStoryHTML(newStory);
      let storyHTMLWithTrashIcon = newStoryWithTrashIcon(storyHTML);
      $allStoriesList.prepend(storyHTMLWithTrashIcon);
      $url.val('');
      $title.val('');
      $author.val('');
    }
  })

  //append favorite to the page
  $('body').on('click', '.fa-star', async function(evt) {
    if ($(this).hasClass('hasBeenFavorited')) return;
    if (currentUser) $(this).addClass('hasBeenFavorited');


    let favoriteHTML = await generateStoryHTML(await retrieveFavorite(evt));
    let button = document.createElement('i');

    button.classList.add('fas', 'fa-trash-alt', 'favorite-remove-button');
    favoriteHTML.prepend(button);
    $favoritedArticles.prepend(favoriteHTML);
    
  })

  //remove favorite from the page
  $('#favorited-articles').on('click', '.favorite-remove-button' , async function(evt) {
    let storyId = this.parentElement.id;
    await User.removeFavorite(currentUser, storyId)
    this.parentElement.remove();
    $(`#${storyId}`).children().eq(0).removeClass('hasBeenFavorited');
  })

  $('body').on('click', '.new-story-with-trash-icon', function() {
    let $storyId = $(this).parent().attr('id');

    User.removeStory(currentUser, $(this).parent().attr('id'))
    $(`#${$storyId}`).remove();
  })



  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();
    
    

    if (currentUser) {
      checkForMyStories();
      checkForFavorites();
      showNavForLoggedInUser();
      $submitForm.show();
      $favoritedArticles.show();
      generateFavorites();
      addProfileToPage();
    }
  }

  /**
   * A rendering function to run to reset the forms and hide the login info
   */

  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();

    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");

    // show the stories
    $allStoriesList.show();

    // update the navigation bar
    showNavForLoggedInUser();

    // show the add-story form
    $submitForm.show();

    // show the favorited stories
    $favoritedArticles.show();
  }

  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();

    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      const star = document.createElement('i')
      star.classList.add('fas', 'fa-star');
      result.prepend(star);
      $allStoriesList.append(result);
    }
  }

  // A function to generate the stories on the page

  function generateFavorites() {
    let token = localStorage.getItem('token');
    let username = localStorage.getItem('username');
    let favorites = currentUser.favorites;
    // empty out that part of the page
    $favoritedArticles.empty();

    // loop through all of our favorites and generate HTML for them
    for (let favorite of favorites) {
      const result = generateStoryHTML(favorite);
      let trash = document.createElement('i');
      trash.classList.add('fas', 'fa-trash-alt', 'favorite-remove-button');
      result.prepend(trash);
      $favoritedArticles.append(result);
    }
  }

  /**
   * A function to render HTML for an individual Story instance
   */

  function generateStoryHTML(story) {
    let hostName = getHostName(story.url);

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  /* hide all elements in elementsArr */

  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {
    $navLogin.hide();
    $navLogOut.show();
  }

  /* simple function to pull the hostname from a URL */

  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  /* sync current user information to localStorage */

  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }

  // Collects the new story information from the submit form and returns a POJO with that info

  function getCreatedStoryValues() {
    let $urlVal = $url.val();
    let $titleVal = $title.val();
    let $authorVal = $author.val();
    let newStory = {
      author: $authorVal,
      title: $titleVal,
      url: $urlVal
    }
    return newStory;
  }

  // When a star is clicked, this function is ran so that we can add a favorite to the user. Then this favorite
  //is returned so that we can add it to the page

  async function retrieveFavorite(evt) {
    let storyID = evt.target.parentElement.id;
    let favoritedStory = await User.newFavorite(currentUser, storyID);
    return favoritedStory;
  }

  // Take the HTML that's passed in, and add a star to it, then return the HTML

  function addStarIcon(storyHTML) {
    const star = document.createElement('i')
    star.classList.add('fas', 'fa-star');
    storyHTML.prepend(star);
    return storyHTML;
  }

  // When the page refreshes, or when we login, we run this function to make favorited stories have a yellow star
  // instead of a regular one

  function checkForFavorites() {
    // grab the favorited story's IDs
    let favoriteIds = currentUser.favorites.map(function(obj) {
      return obj.storyId;
    })
    
    // loop through the stories on the page, check to see if their Id's are one of our favorite story IDs,
    // if so, make their star's yellow
    for (let story of storyList.stories) {
      if (favoriteIds.includes(story.storyId)) {
        $(`#${story.storyId}`).children().eq(0).addClass('hasBeenFavorited')
      }
    }
  }

  // When we login or refresh the page, check to see which stories on the page are the ones we created, 
  // and add trash cans to them

  function checkForMyStories() {
    // grab all the ID's in ownStories
    let myStoryIds = currentUser.ownStories.map(function(obj) {
      return obj.storyId;
    })
    
    // loop through the stories on the page, if their story ID is one of our story ID'S, we add a trash
    // can to them, and remove the star, since we will not favorite our own stories
    for (let story of storyList.stories) {
      if (myStoryIds.includes(story.storyId)) {
        $(`#${story.storyId}`).children().eq(0).removeClass('fa-star');
        $(`#${story.storyId}`).children().eq(0).addClass('fa-trash-alt new-story-with-trash-icon');
      }
    }
  }

  // If someone clicks on the trash can to remove their own story, let the API know about it, and also
  // remove the story from the page

  async function removeStory(currentUser, storyId) {
    await User.removeStory(currentUser, storyId);
    $(`#${storyId}`).remove();
  }

  // when someone creates a new story, first prepend a trash can to that story so we can delete it
  // if we want to 

  function newStoryWithTrashIcon(storyHTML) {
    let trashIcon = document.createElement('i');
    trashIcon.classList.add('fas', 'fa-trash-alt', 'new-story-with-trash-icon');
    storyHTML.prepend(trashIcon);
    
    return storyHTML;
  }

  // When someone logs in, creates an account, or refreshes the page while logged in,
  // grab the username, name, and date from the current user, and display these on the page

  function addProfileToPage() {
    // grab the data
    let displayUser = currentUser.username;
    let displayName = currentUser.name;
    let displayDate = currentUser.createdAt;

    // append the data to the page
    $profileUsername.append(` <b class="profile-info">${displayUser}</b>`);
    $profileName.append(` <b class="profile-info">${displayName}</b>`);
    $profileAccDate.append(` <b class="profile-info">${displayDate}</b>`);
  }
});
