# Game Design Document

## Section 0: Summary
**Game name:** "Doodle Jump"  

**Team members:**
- Katia Avanesov  
- Maleque Chouayekh  
- Soham Dasgupta

**Concept Statement**  
Our game is based on "Doodle Jump" where you guide a character up a continuous series of moving platforms by jumping onto each one. The goal is to continue to survive for as long as you can by remaining within the screen and also avoiding obstacles such as enemies/ monsters.

## Section 1: Gameplay
**How does the game progress?**  
The game progresses continuously as the user must keep on jumping to new platforms and avoiding monsters in order to survive. Levels/rounds will either last for a fixed time, or merge into one another by making the gameplay harder over time. When the game ends, a menu will be displayed with stats such as number of points collected, and a button to continue the game (stats will be saved) or restart the game (stats will be reset). 

**Win/ Loss conditions**  
The game can be played indefinitely so there is no win condition that will finish the game, but a player's success can be measured by the number of points obtained (the stats can keep track of users' personal best if you choose to save stats between rounds), or also the time that they have stayed alive. There are two loss conditions: firstly, if your character falls off the bottom of the screen (note that horizontal wrap around will be implemented, though); second, if your character collides with an obstacle such as a monster or gets shot by it.

**Are there levels and points?**  
Yes, there will be rounds/ levels which get arbitrarily more hard as they increase (speed up, more monsters). Rounds end when the time for the round runs out.

**Controls**  
The character that the user controls will have mobility in the left and right direction but the vertical bouncing part will be automated by implementing a gravitational force and a 'bounce' force when the character comes in contact with a platform (note: a bounce should only occur when the character lands on the platform rather than passes it from below).  
The controls we will implement are then the left/right arrow keys, and a space bar -- either used for shooting bullets to destroy monsters, or to serve as a 'double jump' or temporary acceleration feature. We will also be implementing the mouse control so that the user can interact with the buttons on the menu screen.

**Game Flow**  
The game starts with the character jumping on a platform. The character must continue to jump to new platforms to remain within the screen -- otherwise, the game is lost. While bouncing, the character encounters enemies/ obstacles such as a 'bad branch' that breaks after it's been jumped on once, and also monsters -- if you collide with them you lose the game. Coins will spawn randomly and can be collected towards your point total as you progress through the levels. New levels/ rounds start after you have survived for a given amount of time. The levels get harder by spawning obstacles more frequently and the speed of the movement gets faster. At the end of each round, you have a Menu option that will pop up and give you the option to view your stats, move on to the next round, or quit the game. 

**Graphics**  
Basic polygons will be used for the graphics with images attached to them like project 6. We will be adding our own characters for the game - both the player and the enemies. We will also be changing the background of the game from a set of photos we choose.

**Physics**  
We will be implementing gravity so that the character falls back down to bounce back up again. Collisions and bouncing will also be implemented, which uses physics concepts.


## Section 2: Feature Set
**Priority 1**
- Contact and collisions with obstacles.
- Gravity and bouncing.
- Key controls.

**Priority 2**
- Graphics and background images for objects.
- A 'moving screen' effect to give the sense that your character is moving upwards.
- Loss condition logic.

**Priority 3**
- Stats tracking and in-game display.
- In-game countdown/ timer for rounds/levels.
- Pause feature.

**Priority 4**
- Menu display.
- Background Pictures / Music for theme of game
- User guide.


## Section 3: Timeline

**Kat's Features**
- **Priority 1: Contact and Collisions**: Implementing destructive forces between the  character and the monsters, and ensuring that the character can bounce/ rebound properly when jumps onto a platform. (May 14th - May 18th).
- **Priority 2:Objects**: Generating all the relevant objects in the game: the user, the monster, the platforms, and the bullets that they shoot, and coin collection. Will also be in charge of timing their exit/ entrance on the screen and their movements, as well as their collisions and contact, see above. (May 19th - May 23rd).
- **Priority 3:Stats**: Implementing the tracking of points and displaying them on the screen, along with a  timer.  (May 25th - May 30th)
- **Priority 4:Menu**: Building upon the concept above, at the end of each round will display a menu with a summary of stats-to-date (e.g. total points, total number of levels completed).  (May 25th - May 30th).

**Soham's Features**
- **Priority 1: Gravity**: Implementing gravity for our player, including moving downward when they are in the air and making the character able to jump onto the blocks (May 12th - May 16th).
- **Priority 2 :Camera Tracking for moving screen**: Define a function to use a fixed height y on the screen and if the player moves above this height we move all other objects downwards towards using graivty to bottom of the screen to give the effect of a moving screen. This gives the effect of the player moving upwards since surrounding objects move down and makes sure the player stays at the center of the game the whole time. (May 19th - May 23rd).
- **Priority 3: Pause/Resume Toggle**: Pressing **P** toggles a paused state that freezes physics, enemy movement, and timers, and renders a “PAUSED” overlay. Also implementing unpaused state where we resume game from the same state we paused at.
  (May 19th – May 23rd)
- **Priority 4: Background Music and Background Photos**: Using SDL_mixer library to add background music for the game. Also adding random background images to game to make it look aesthetic. We will choose from a set of images we store in a folder to make the game more appealing(May 25th - May 30th).

**Maleque's Features**
- **Priority 1: Loss Condition Logic**: Define and implement the game's two failure states:  
  (i) the player falls below the bottom of the screen (with horizontal wrap-around),  
  (ii) the player collides with a monster or is hit by a projectile.  
  (May 12th – May 18th)
- **Priority 2: Input & UI Mechanics**: Handle all user inputs: map the left/right arrows to horizontal movement and the spacebar to a chargeable jump (longer press = higher bounce); implement other controls for menu navigation and stats display.  
  (May 19th – May 23rd)
- **Priority 3: Countdown Timer**: Displaying a timer that counts down from a time limit we set to complete each level (May 25th - May 30th).
- **Priority 4: User guide**: Display the current round number in a corner using the existing text-rendering routine.  
  (May 19th – May 23rd)

## Section 4: Disaster Recovery
**Kat's Disaster Recovery**  
If I fall behind, then I plan to let my team know as soon as possible, and the instructors as well. I can ask for help from the instructors if I find one feature implementation particularly challenging. If there are other features that could be implemented in the mean time while I am stuck, I will proceed with them and prioritise the most important features.

**Soham's Disaster Recovery**  
For me personally, especially in a team project like this starting early and communication will always be the most important thing. I plan to send daily updates on the group, with things I am stuck with and how I am working to resolve it. I also will prioritise going to office hours to get feedback from both the Professors and the TAs because I think the staff is great and if I have tried finding a solution and not been able to, asking for help/advice from the CS3 staff would be my priority. I will also prioritize finishing the core features that I listed. in Section 3 first and then work on anything additional, while allocating enough hours in the later weeks if I fall behind.

**Maleque's Disaster Recovery**  
I plan to start early and implement all of my features over the next two weeks, reserving the final week for debugging and seeking help during office hours if I encounter any issues I cannot resolve on my own. I will maintain clear communication—providing regular progress updates to my team and being transparent about any blockers—to ensure that I stay on track or pivot to other tasks while I wait for assistance.
