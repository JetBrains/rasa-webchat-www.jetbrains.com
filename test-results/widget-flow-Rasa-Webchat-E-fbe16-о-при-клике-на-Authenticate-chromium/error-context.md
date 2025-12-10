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
      - button "close" [ref=e18] [cursor=pointer]:
        - img "close" [ref=e19]
    - generic [ref=e21]:
      - paragraph [ref=e22]: Hi! To proceed with AI Assistant Chat Bot you need to authenticate first
      - button "Authenticate here" [active] [ref=e23] [cursor=pointer]
```