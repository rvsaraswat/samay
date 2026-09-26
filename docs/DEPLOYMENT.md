# Deployment

The production web image is built from the repository root:

```sh
docker build -f webapp/Dockerfile -t ghadi .
docker run --rm -p 8080:8080 ghadi
```

The image installs the Python dependencies, downloads Swiss Ephemeris data into `/app/ephe`, and starts Gunicorn through `webapp/docker-entrypoint.sh`. Set `PORT` when the hosting platform supplies a non-default port. The process uses one worker because Swiss Ephemeris and ayanamsha selection are process-global; threaded requests are serialized around coordinate-sensitive calculations.

For validation, run the Flask test client or the existing test suite in the container. Windows development environments without Microsoft C++ Build Tools may not be able to build `pyswisseph`; Docker is the supported local path in that case.
