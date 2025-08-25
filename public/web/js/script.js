document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const userContainer = document.getElementById('user-container');
    const loginNav = document.getElementById('login-nav');
    const userNav = document.getElementById('user-nav');
    const loginButtons = document.querySelectorAll('.tg-login');
    const logoutButton = document.getElementById('logout-button');
    const userFirstname = document.getElementById('user-firstname');
    const userUsername = document.getElementById('user-username');
    const totalPoints = document.getElementById('total-points');
    const spinButton = document.getElementById('spin-button');
    const withdrawButton = document.getElementById('withdraw-button');
    const spinResult = document.getElementById('spin-result');
    const wheel = document.querySelector('.wheel');
    const withdrawRequestsBody = document.getElementById('withdraw-requests-body');
    const referralLinkInput = document.getElementById('referral-link');
    const copyReferralLinkButton = document.getElementById('copy-referral-link');

    let pollingInterval = null;
    let currentRotation = 0;

    // Function to check auth status and update UI
    const checkAuth = () => {
        fetch('/check-auth')
            .then(response => response.json())
            .then(data => {
                if (data.loggedIn) {
                    userFirstname.textContent = data.user.first_name;
                    // userUsername.textContent = data.user.username;
                    totalPoints.textContent = data.user.total_points || 0;
                    document.getElementById('total-points-value').textContent = data.user.total_points || 0;
                    loginContainer.classList.add('d-none');
                    userContainer.classList.remove('d-none');
                    loginNav.classList.add('d-none');
                    userNav.classList.remove('d-none');

                    fetchWithdrawHistory();
                    fetchPurchaseHistory();
                    fetchReferralCode();
                } else {
                    loginContainer.classList.remove('d-none');
                    userContainer.classList.add('d-none');
                    loginNav.classList.remove('d-none');
                    userNav.classList.add('d-none');
                }
            });
    };

    // Fetch referral code
    const fetchReferralCode = () => {
        fetch('/referral-code')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const referralCode = data.referralCode;
                    const url = new URL(window.location.href);
                    const referralLink = `${url.origin}?ref=${referralCode}`;
                    referralLinkInput.value = referralLink;
                }
            });
    };

    // Copy referral link to clipboard
    copyReferralLinkButton.addEventListener('click', () => {
        const referralLink = referralLinkInput.value;
        if (referralLink && navigator.clipboard) {
            navigator.clipboard.writeText(referralLink).then(() => {
                copyReferralLinkButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyReferralLinkButton.textContent = 'Copy';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                // Fallback for older browsers
                referralLinkInput.select();
                document.execCommand('copy');
            });
        } else {
            // Fallback for older browsers
            referralLinkInput.select();
            document.execCommand('copy');
        }
    });

    // Start the login process
    loginButtons.forEach(button => {
        button.addEventListener('click', () => {
            const telegramTab = window.open('', '_blank');
            if (!telegramTab || telegramTab.closed || typeof telegramTab.closed === 'undefined') {
                alert('Please allow popups for this site to log in with Telegram.');
                return;
            }
            telegramTab.document.write('Connecting to Telegram...');

            fetch('/tg-login-start', { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    const token = data.token;
                    const botUsername = 'yarrak564864864_bot';
                    const urlParams = new URLSearchParams(window.location.search);
                    const ref = urlParams.get('ref');
                    let startPayload = token;
                    if (ref) {
                        startPayload += `-${ref}`;
                    }
                    const telegramUrl = `https://t.me/${botUsername}?start=${startPayload}`;
                    if (telegramTab) {
                        telegramTab.location.href = telegramUrl;
                    }
                    startPolling(token);
                })
                .catch(err => {
                    console.error('Login start error:', err);
                    if (telegramTab) {
                        telegramTab.close();
                    }
                    alert('Could not initiate Telegram login. Please try again.');
                });
        });
    });

    // Poll the server to see if authentication is complete
    const startPolling = (token) => {
        // Clear any existing intervals
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }

        pollingInterval = setInterval(() => {
            fetch('/tg-login-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    clearInterval(pollingInterval);
                    // Clear the ref parameter from the URL
                    const url = new URL(window.location.href);
                    url.searchParams.delete('ref');
                    window.history.replaceState({}, document.title, url);
                    location.reload(); // Reload the page to reflect the logged-in state
                }
            });
        }, 2000); // Poll every 2 seconds

        // Stop polling after 2 minutes
        setTimeout(() => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                console.log('Login timed out.');
            }
        }, 120000);
    };

    // Handle logout
    logoutButton.addEventListener('click', () => {
        fetch('/logout', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                }
            });
    });

    // Initial check when the page loads
    checkAuth();

    // Handle spinning the wheel
    spinButton.addEventListener('click', () => {
        spinButton.disabled = true;
        spinResult.textContent = 'Spinning...';
        spinResult.classList.remove('text-success', 'text-danger');


        fetch('/spin', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const { result } = data;

                    // This array MUST match the order of slices in index.html
                    const visualSlices = [10, '$200', 20, 50, 100, '$500', 200, 500, 1000, 'JACKPOT'];
                    
                    // Find the visual index of the winning slice
                    const visualWinningIndex = visualSlices.findIndex(slice => slice === result);

                    // If for some reason the prize isn't found, default to the first slice to avoid errors
                    if (visualWinningIndex === -1) {
                        console.error("Could not find the winning slice in the visual layout!");
                        visualWinningIndex = 0;
                    }

                    // Calculate the rotation to land on the winning slice
                    const sliceAngle = 360 / 10; // 10 slices
                    const targetRotation = 360 - (visualWinningIndex * sliceAngle);

                    const randomRotations = Math.floor(Math.random() * 5) + 5;
                    const totalRotation = (360 * randomRotations) + targetRotation;

                    currentRotation = totalRotation;
                    wheel.style.transform = `rotate(${currentRotation}deg)`;

                    // Wait for the animation to finish
                    setTimeout(() => {
                        if (result === 'JACKPOT') {
                            spinResult.textContent = `JACKPOT! You won ${data.points} points!`;
                        } else {
                            spinResult.textContent = `Congratulations! You won ${data.points} points.`;
                        }
                        spinResult.classList.add('text-success');
                        // Update total points on the navbar
                        checkAuth();
                    }, 5000); // Corresponds to the CSS transition duration
                } else {
                    spinResult.textContent = data.message;
                    spinResult.classList.add('text-danger');
                    // Re-enable the button if the error was not about having already spun
                    if (!data.message.includes('already spun')) {
                        spinButton.disabled = false;
                    }
                }
            })
            .catch(error => {
                console.error('Error spinning the wheel:', error);
                spinResult.textContent = 'An error occurred. Please try again.';
                spinResult.classList.add('text-danger');
                spinButton.disabled = false;
            });
    });

    const fetchWithdrawHistory = () => {
        fetch('/withdraw-history')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    withdrawRequestsBody.innerHTML = ''; // Clear existing rows
                    if (data.history.length === 0) {
                        const row = document.createElement('tr');
                        const cell = document.createElement('td');
                        cell.colSpan = 4;
                        cell.textContent = 'No withdrawal history yet.';
                        cell.classList.add('text-center');
                        row.appendChild(cell);
                        withdrawRequestsBody.appendChild(row);
                    } else {
                        data.history.forEach(request => {
                            const row = document.createElement('tr');

                            const dateCell = document.createElement('td');
                            dateCell.textContent = new Date(request.request_date).toLocaleString();
                            row.appendChild(dateCell);

                            const pointsCell = document.createElement('td');
                            pointsCell.textContent = request.points;
                            row.appendChild(pointsCell);

                            const walletCell = document.createElement('td');
                            walletCell.textContent = request.solana_address;
                            row.appendChild(walletCell);

                            const statusCell = document.createElement('td');
                            statusCell.textContent = request.status;
                            row.appendChild(statusCell);

                            withdrawRequestsBody.appendChild(row);
                        });
                    }
                }
            });
    };

    const fetchPurchaseHistory = () => {
        const purchaseHistoryBody = document.getElementById('purchase-history-body');
        if (!purchaseHistoryBody) return; // Skip if element doesn't exist

        fetch('/purchase-history')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    purchaseHistoryBody.innerHTML = ''; // Clear existing rows
                    if (data.history.length === 0) {
                        const row = document.createElement('tr');
                        const cell = document.createElement('td');
                        cell.colSpan = 3;
                        cell.textContent = 'No purchase history yet.';
                        cell.classList.add('text-center');
                        row.appendChild(cell);
                        purchaseHistoryBody.appendChild(row);
                    } else {
                        data.history.forEach(purchase => {
                            const row = document.createElement('tr');

                            const dateCell = document.createElement('td');
                            dateCell.textContent = new Date(purchase.purchase_date).toLocaleString();
                            row.appendChild(dateCell);

                            const itemCell = document.createElement('td');
                            // Format item name (replace hyphens with spaces and capitalize words)
                            const formattedItem = purchase.item.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            itemCell.textContent = formattedItem;
                            row.appendChild(itemCell);

                            const pointsCell = document.createElement('td');
                            pointsCell.textContent = purchase.points;
                            row.appendChild(pointsCell);

                            purchaseHistoryBody.appendChild(row);
                        });
                    }
                }
            });
    };

    const withdrawModalElement = document.getElementById('withdraw-modal');
    const withdrawModal = new bootstrap.Modal(withdrawModalElement);

    withdrawModalElement.addEventListener('hidden.bs.modal', () => {
        withdrawButton.focus();
    });
    const withdrawForm = document.getElementById('withdraw-form');
    const solanaWalletInput = document.getElementById('solana-wallet');
    const pointsAmountInput = document.getElementById('points-amount');

    withdrawButton.addEventListener('click', () => {
        withdrawModal.show();
    });

    withdrawForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const solanaAddress = solanaWalletInput.value.trim();
        const points = parseInt(pointsAmountInput.value, 10);
        const currentUserPoints = parseInt(totalPoints.textContent, 10);

        if (!solanaAddress) {
            alert('Please enter a valid Solana address.');
            return;
        }
        if (!points || points < 20000) {
            alert('The minimum withdrawal amount is 20,000 points.');
            return;
        }
        if (points > currentUserPoints) {
            alert(`Your withdrawal request of ${points} points exceeds your current balance of ${currentUserPoints} points.`);
            return;
        }

        const submitButton = withdrawForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        fetch('/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ solanaAddress, points })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Withdrawal request submitted successfully!');
                withdrawModal.hide();
                checkAuth();
            } else {
                alert(`Error: ${data.message}`);
            }
        })
        .finally(() => {
            submitButton.disabled = false;
        });
    });

    // Handle store purchases
    const purchaseButtons = document.querySelectorAll('.purchase-btn');
    purchaseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const item = button.getAttribute('data-item');
            const points = parseInt(button.getAttribute('data-points'));
            const currentUserPoints = parseInt(totalPoints.textContent, 10);

            if (points > currentUserPoints) {
                alert(`You don't have enough points to purchase this item. You need ${points} points but you only have ${currentUserPoints} points.`);
                return;
            }

            // Disable button during purchase
            button.disabled = true;
            const originalText = button.textContent;
            button.textContent = 'Processing...';

            // Send purchase request to server
            fetch('/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item, points })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(`Congratulations! You've successfully purchased the ${item.replace('-', ' ')}.`);
                    // Update points display
                    checkAuth();
                } else {
                    alert(`Error: ${data.message}`);
                }
            })
            .catch(error => {
                console.error('Error purchasing item:', error);
                alert('An error occurred while processing your purchase. Please try again.');
            })
            .finally(() => {
                // Re-enable button
                button.disabled = false;
                button.textContent = originalText;
            });
        });
    });
});
