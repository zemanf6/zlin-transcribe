1. Create a folder /data/sessions/zlin-zm-yyyy-mm-dd/source (optionally you can create /raw too)
2. In that folder, create .txt files agenda-transcript.txt, board-members.txt, council-members.txt
 - You can get the transcript from the Zlin web, other files you can copy, they don't change that often
3. Run command: npm run generate:session -- zlin-zm-yyyy-mm-dd --video-url "video-url-here"

4. Save video to /data/sessions/zlin-zm-yyyy-mm-dd/video/input.mp4
5. Run: npm run generate:transcript -- zlin-zm-yyyy-mm-dd