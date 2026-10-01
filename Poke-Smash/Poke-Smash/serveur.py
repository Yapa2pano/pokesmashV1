# Petit serveur local pour Poké Smash (lancé par « Lancer le jeu.bat »).
# Il désactive le cache du navigateur : après une mise à jour du jeu, un simple F5 suffit.
import functools
import http.server
import os
import sys

class SansCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, *args):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
dossier = os.path.dirname(os.path.abspath(__file__))
print(f'Poke Smash : http://localhost:{port}  (laisse cette fenetre ouverte pendant la partie)')
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(SansCache, directory=dossier)).serve_forever()
