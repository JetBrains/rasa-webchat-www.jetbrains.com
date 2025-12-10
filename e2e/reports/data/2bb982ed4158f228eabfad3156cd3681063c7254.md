# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Send chitchat.greet without text" [ref=e2] [cursor=pointer]:
    - /url: "#"
  - link "Send chitchat.greet with text" [ref=e3] [cursor=pointer]:
    - /url: "#"
  - generic [ref=e4]: test
  - generic [ref=e5]: test
  - generic [ref=e6]: test
  - heading "test" [level=1] [ref=e7]
  - button "MY BUTTON" [ref=e8]
  - generic [ref=e11]:
    - generic [ref=e14]:
      - heading "JetBrains Support Assistant" [level=4] [ref=e15]:
        - img "JetBrains" [ref=e16]
        - text: Support Assistant
      - generic [ref=e17]:
        - button [ref=e18] [cursor=pointer]
        - button "close" [ref=e19] [cursor=pointer]:
          - img "close" [ref=e20]
    - generic [ref=e22]:
      - paragraph [ref=e27]:
        - strong [ref=e28]: Hi there! Looking for help? This is the right place!
        - text: Here you can ask about JetBrains products and licenses, get help troubleshooting problems, report bugs, ask for features, etc.
      - paragraph [ref=e33]: This chat is still work in progress, so provided information may be incomplete or inaccurate. We are working hard on making it better.
      - paragraph [ref=e38]: What do you need help with?
    - generic [ref=e39]:
      - textbox "Type a message..." [active] [ref=e40]
      - button [disabled] [ref=e41]:
        - img [ref=e42]
```