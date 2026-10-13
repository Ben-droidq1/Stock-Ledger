with open('C:\\Users\\USER\\Documents\\codes\\shop-analytics\\vite-project/server.js') as f:
    lines = f.readlines()
# Insert after line 387 (index 387), before line 389 (index 388)
# Line 387 is ')))\n', line 388 is '\n', line 389 starts 'const authenticate'
new_lines = [
    'app.get(\"/api/auth/config\", asyncRoute(async (req, res) => {\n',
    '  res.json({ googleClientId: googleClientId or \"\" })\n',
    '})\n',
    '\n',
]
# Insert at position 388 (after line 387, which is index 387, so insert at 388)
lines[388:388] = new_lines
with open('C:\\Users\\USER\\Documents\\codes\\shop-analytics\\vite-project/server.js', 'w') as f:
    f.writelines(lines)
print('Done')