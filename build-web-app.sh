#!/bin/bash
docker build --rm -t avemepls/spending-tracker_web-app:latest .
docker push avemepls/spending-tracker_web-app:latest
